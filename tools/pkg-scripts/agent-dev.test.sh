#!/bin/sh
# Optional local smoke script for agent-dev's lifecycle. Creates a throwaway
# checkout under .tmp with a fake Vite/miniflare, so it never touches real
# dev servers. Run it directly when changing agent-dev.sh; it is not a gate.
set -u

DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH= cd -- "$DIR/../.." && pwd -P)
TEST_ROOT="$ROOT/.tmp/agent-dev-test.$$"
PASSES=0
FAILS=0

cleanup() {
	if command -v pkill >/dev/null 2>&1; then
		pkill -f "$TEST_ROOT/node_modules" 2>/dev/null || true
	fi
	rm -rf "$TEST_ROOT"
}

trap cleanup EXIT INT TERM

pass() {
	PASSES=$((PASSES + 1))
	printf 'ok   %s\n' "$1"
}

fail() {
	FAILS=$((FAILS + 1))
	printf 'FAIL %s\n' "$1"
}

assert_contains() {
	case "$1" in
		*"$2"*) pass "$3" ;;
		*)
			printf '  got: %s\n' "$1"
			fail "$3"
			;;
	esac
}

assert_gone() {
	if kill -0 "$1" 2>/dev/null; then
		fail "$2"
	else
		pass "$2"
	fi
}

find_ports() {
	node -e '
		const net = require("node:net")
		const start = Number(process.argv[1])
		const end = Number(process.argv[2])
		const count = Number(process.argv[3])
		const found = []
		const probe = (port) =>
			new Promise((resolve) => {
				const server = net.createServer()
				server.once("error", () => resolve(false))
				server.listen(port, () => server.close(() => resolve(true)))
			})
		;(async () => {
			for (let port = start; port <= end && found.length < count; port += 1) {
				if (await probe(port)) found.push(port)
			}
			if (found.length < count) process.exit(1)
			console.log(found.join(" "))
		})()
	' "$1" "$2" "$3"
}

run_agent() {
	(
		cd "$TEST_ROOT" || exit 1
		DEV_PORT=$HUMAN AGENT_DEV_PORT=$SHARED AGENT_DEV_MAX_SERVERS=4 \
			AGENT_DEV_HEALTH_TRIES=$HEALTH_TRIES FAKE_HEALTH_DELAY=$HEALTH_DELAY \
			sh tools/pkg-scripts/agent-dev.sh __wunstart_agent_dev_env_loaded "$@" 2>&1
	)
}

start_manual_vite() {
	manual_port=$1
	manual_extra=$2
	(
		cd "$TEST_ROOT" || exit 1
		env DEV_ROLE=agent AGENT_DEV_PORT="$manual_port" $manual_extra \
			node "$TEST_ROOT/node_modules/vite/bin/vite.js" >/dev/null 2>&1 &
		printf '%s\n' "$!"
	)
}

if ! AGENT_PORTS=$(find_ports 3100 3199 3); then
	echo 'FAIL could not find three free agent ports'
	exit 1
fi

if ! HUMAN=$(find_ports 3300 3399 1); then
	echo 'FAIL could not find a free human port'
	exit 1
fi

set -- $AGENT_PORTS
SHARED=$1
WEDGE=$2
SHIM=$3

# Keep the smoke run quick: the real budget is 60 seconds. Test 6b relies on
# the shortened start budget; test 6c raises it while a fake server boots.
HEALTH_TRIES=2
HEALTH_DELAY=0

mkdir -p "$TEST_ROOT/tools/pkg-scripts" "$TEST_ROOT/node_modules/vite/bin" \
	"$TEST_ROOT/node_modules/miniflare" "$TEST_ROOT/node_modules/.bin" "$TEST_ROOT/.tmp"

cp "$ROOT/tools/pkg-scripts/agent-dev.sh" "$TEST_ROOT/tools/pkg-scripts/agent-dev.sh"

cat >"$TEST_ROOT/tools/pkg-scripts/install-deps.sh" <<'FAKE_DEPS'
#!/bin/sh
exit 0
FAKE_DEPS

cat >"$TEST_ROOT/node_modules/vite/bin/vite.js" <<'FAKE_VITE'
const http = require('node:http')
const {spawn} = require('node:child_process')
const path = require('node:path')

const role = process.env.DEV_ROLE
const port = Number(process.env[role === 'agent' ? 'AGENT_DEV_PORT' : 'DEV_PORT'])
const healthDelayMs = Number(process.env.FAKE_HEALTH_DELAY || 0)
const listenDelayMs = Number(process.env.FAKE_LISTEN_DELAY || 0)
const startedAt = Date.now()

if (process.env.FAKE_NO_LISTEN !== '1') {
	const server = http.createServer((_, res) => {
		if (Date.now() - startedAt < healthDelayMs) {
			res.statusCode = 503
			res.end('starting')
			return
		}

		res.end('ok')
	})
	const listen = () => server.listen(port, '127.0.0.1')
	if (listenDelayMs > 0) setTimeout(listen, listenDelayMs)
	else listen()
}

if (process.env.FAKE_NO_WORKERD !== '1') {
	const script =
		process.env.FAKE_WORKERD_SHIM === '1'
			? path.join(__dirname, '../../.bin/miniflare')
			: path.join(__dirname, '../../miniflare/fake.js')
	spawn(process.execPath, [script], {stdio: 'ignore'})
}

setInterval(() => {}, 1000)
FAKE_VITE

printf '%s\n' 'setInterval(() => {}, 1000)' >"$TEST_ROOT/node_modules/miniflare/fake.js"
printf '%s\n' 'setInterval(() => {}, 1000)' >"$TEST_ROOT/node_modules/.bin/miniflare"

# 1. Start, then reuse, the shared agent server.
shared_out=$(run_agent start)
assert_contains "$shared_out" 'shared agent dev server started' 'start shared server'
SHARED_PID=$(lsof -ti ":$SHARED" -sTCP:LISTEN | head -n 1)

reuse_out=$(run_agent start)
assert_contains "$reuse_out" 'reused the shared agent dev server' 'reuse shared server'

# 2. Fresh start and graceful stop.
fresh_out=$(run_agent start --fresh)
assert_contains "$fresh_out" 'fresh agent dev server started' 'start fresh server'
FRESH=$(printf '%s\n' "$fresh_out" | sed -n 's/^port: //p' | head -n 1)
FRESH_PID=$(lsof -ti ":$FRESH" -sTCP:LISTEN | head -n 1)
FRESH_WORKERD=$(pgrep -P "$FRESH_PID" | head -n 1)
fresh_stop_out=$(run_agent stop --port "$FRESH")
assert_contains "$fresh_stop_out" 'stopped fresh agent dev server' 'stop fresh server'
if [ -n "$FRESH_WORKERD" ]; then
	assert_gone "$FRESH_WORKERD" 'fresh stop reaps its workerd'
else
	fail 'fresh stop reaps its workerd'
fi

# 3. Hard-killed Vite leaves an orphan; stop --port reaps it.
hard_out=$(run_agent start --fresh)
HARD=$(printf '%s\n' "$hard_out" | sed -n 's/^port: //p' | head -n 1)
HARD_PID=$(lsof -ti ":$HARD" -sTCP:LISTEN | head -n 1)
HARD_WORKERD=$(pgrep -P "$HARD_PID" | head -n 1)
kill -9 "$HARD_PID"
sleep 1
orphan_out=$(run_agent stop --port "$HARD")
assert_contains "$orphan_out" 'stopping orphaned workerd' 'hard-kill cleanup reports orphan'
if [ -n "$HARD_WORKERD" ]; then
	assert_gone "$HARD_WORKERD" 'stop --port reaps hard-kill orphan'
else
	fail 'stop --port reaps hard-kill orphan'
fi

# 4. A wedged agent Vite with no listener is visible and stoppable.
WEDGE_PID=$(start_manual_vite "$WEDGE" 'FAKE_NO_LISTEN=1 FAKE_NO_WORKERD=1')
sleep 1
status_out=$(run_agent status)
assert_contains "$status_out" "$WEDGE" 'status shows non-listening agent Vite'
wedge_out=$(run_agent stop --port "$WEDGE")
assert_contains "$wedge_out" 'stopped fresh agent dev server' 'stop --port stops non-listening agent Vite'
assert_gone "$WEDGE_PID" 'wedged agent Vite is gone'

# 5. Node-run .bin/miniflare is recognized as a worker.
SHIM_PID=$(start_manual_vite "$SHIM" 'FAKE_NO_LISTEN=1 FAKE_WORKERD_SHIM=1')
sleep 1
SHIM_WORKERD=$(pgrep -P "$SHIM_PID" | head -n 1)
kill -9 "$SHIM_PID"
sleep 1
shim_out=$(run_agent stop --port "$SHIM")
assert_contains "$shim_out" 'stopping orphaned workerd' 'shim orphan is recognized'
if [ -n "$SHIM_WORKERD" ]; then
	assert_gone "$SHIM_WORKERD" 'stop --port reaps .bin/miniflare orphan'
else
	fail 'stop --port reaps .bin/miniflare orphan'
fi

# 6. A live non-Vite parent (wrangler-like) protects its worker from stop-all.
cat >"$TEST_ROOT/wrap.sh" <<'FAKE_WRAP'
#!/bin/sh
node "$1/node_modules/miniflare/fake.js"
:
FAKE_WRAP
sh "$TEST_ROOT/wrap.sh" "$TEST_ROOT" >/dev/null 2>&1 &
WRAP_PID=$!
sleep 1
WRAP_WORKERD=$(pgrep -P "$WRAP_PID" | head -n 1)
run_agent stop-all >/dev/null
assert_gone "$SHARED_PID" 'stop-all stops the shared server'
if [ -n "$WRAP_WORKERD" ] && kill -0 "$WRAP_WORKERD" 2>/dev/null; then
	pass 'stop-all leaves a live non-Vite parent worker alone'
else
	fail 'stop-all leaves a live non-Vite parent worker alone'
fi
kill "$WRAP_WORKERD" "$WRAP_PID" 2>/dev/null || true

# 6b. A child that only becomes healthy after the first health budget is a
# start success, not a bind-race loser: start must not stop it and report
# another agent's server.
HEALTH_DELAY=3
slow_out=$(run_agent start)
HEALTH_DELAY=0
assert_contains "$slow_out" 'shared agent dev server started' 'slow child takes the success path'
case "$slow_out" in
	*'another agent won the bind'*) fail 'slow child is not adopted as a bind race' ;;
	*) pass 'slow child is not adopted as a bind race' ;;
esac
SLOW_PID=$(lsof -ti ":$SHARED" -sTCP:LISTEN | head -n 1)
if [ -n "$SLOW_PID" ] && kill -0 "$SLOW_PID" 2>/dev/null; then
	pass 'slow child is still serving after start'
else
	fail 'slow child is still serving after start'
fi
run_agent stop-all >/dev/null
assert_gone "$SLOW_PID" 'stop-all stops the slow shared child'

# 6c. A concurrent start that owns the shared port but has not bound yet is
# awaited, then reused through the normal validation path.
HEALTH_TRIES=5
STARTING_PID=$(start_manual_vite "$SHARED" 'FAKE_LISTEN_DELAY=3')
sleep 1
starting_out=$(run_agent start)
HEALTH_TRIES=2
assert_contains "$starting_out" 'reused the shared agent dev server' 'start waits for a booting shared server'
run_agent stop-all >/dev/null
assert_gone "$STARTING_PID" 'stop-all reaps the awaited shared server'

# 7. A wedged shared Vite blocks a duplicate shared start.
SHARED_WEDGE_PID=$(start_manual_vite "$SHARED" 'FAKE_NO_LISTEN=1 FAKE_NO_WORKERD=1')
sleep 1
duplicate_out=$(run_agent start)
assert_contains "$duplicate_out" 'shared agent Vite is already running' 'shared start refuses a duplicate'
run_agent stop-all >/dev/null
assert_gone "$SHARED_WEDGE_PID" 'stop-all reaps a wedged shared Vite'

# 8. A wedged fresh Vite reserves its port, so start --fresh skips it.
WEDGE_PID=$(start_manual_vite "$WEDGE" 'FAKE_NO_LISTEN=1 FAKE_NO_WORKERD=1')
sleep 1
skip_out=$(run_agent start --fresh)
SKIP=$(printf '%s\n' "$skip_out" | sed -n 's/^port: //p' | head -n 1)
if [ -n "$SKIP" ] && [ "$SKIP" -ne "$WEDGE" ]; then
	pass 'start --fresh skips a wedged port'
else
	printf '  got: %s\n' "$skip_out"
	fail 'start --fresh skips a wedged port'
fi
run_agent stop --port "$SKIP" >/dev/null
run_agent stop --port "$WEDGE" >/dev/null
assert_gone "$WEDGE_PID" 'wedged fresh port cleaned up'

# 9. Human server (outside the agent range, no DEV_ROLE) survives stop-all.
(
	cd "$TEST_ROOT" || exit 1
	DEV_PORT=$HUMAN FAKE_NO_WORKERD=1 node "$TEST_ROOT/node_modules/vite/bin/vite.js" >/dev/null 2>&1 &
	printf '%s\n' "$!" >"$TEST_ROOT/human.pid"
)
HUMAN_PID=$(cat "$TEST_ROOT/human.pid")
sleep 1
human_status_out=$(run_agent status)
assert_contains "$human_status_out" 'human' 'status labels the human server'
assert_contains "$human_status_out" 'terminal' 'status points the human log at the terminal'
run_agent stop-all >/dev/null
if kill -0 "$HUMAN_PID" 2>/dev/null; then
	pass 'stop-all leaves the human server alone'
else
	fail 'stop-all leaves the human server alone'
fi
kill "$HUMAN_PID" 2>/dev/null || true

# 10. A listener on the shared port without agent identity is not adopted.
(
	cd "$TEST_ROOT" || exit 1
	DEV_PORT=$SHARED DEV_ROLE=human FAKE_NO_WORKERD=1 node "$TEST_ROOT/node_modules/vite/bin/vite.js" >/dev/null 2>&1 &
	printf '%s\n' "$!" >"$TEST_ROOT/wrong-role.pid"
)
WRONG_ROLE_PID=$(cat "$TEST_ROOT/wrong-role.pid")
sleep 1
wrong_role_out=$(run_agent start)
assert_contains "$wrong_role_out" 'not this worktree' 'shared start refuses a non-agent listener'
run_agent stop-all >/dev/null
if kill -0 "$WRONG_ROLE_PID" 2>/dev/null; then
	pass 'stop-all leaves a non-agent listener alone'
else
	fail 'stop-all leaves a non-agent listener alone'
fi
kill "$WRONG_ROLE_PID" 2>/dev/null || true

# 11. A shared Vite pointing at another database is not adopted.
(
	cd "$TEST_ROOT" || exit 1
	DEV_ROLE=agent AGENT_DEV_PORT=$SHARED DATABASE_URL=postgres://localhost/wrong_db \
		FAKE_NO_WORKERD=1 node "$TEST_ROOT/node_modules/vite/bin/vite.js" >/dev/null 2>&1 &
	printf '%s\n' "$!" >"$TEST_ROOT/wrong-db.pid"
)
WRONG_DB_PID=$(cat "$TEST_ROOT/wrong-db.pid")
sleep 1
wrong_db_out=$(DATABASE_URL=postgres://localhost/right_db run_agent start)
assert_contains "$wrong_db_out" 'different database' 'shared start refuses a different database'
kill "$WRONG_DB_PID" 2>/dev/null || true

# 12. stop --port refuses a listener that is not an agent Vite for that port.
(
	cd "$TEST_ROOT" || exit 1
	DEV_PORT=$WEDGE DEV_ROLE=human FAKE_NO_WORKERD=1 node "$TEST_ROOT/node_modules/vite/bin/vite.js" >/dev/null 2>&1 &
	printf '%s\n' "$!" >"$TEST_ROOT/wrong-stop.pid"
)
WRONG_STOP_PID=$(cat "$TEST_ROOT/wrong-stop.pid")
sleep 1
wrong_stop_out=$(run_agent stop --port "$WEDGE")
assert_contains "$wrong_stop_out" 'not an agent Vite for that port' 'stop --port refuses a non-agent listener'
kill "$WRONG_STOP_PID" 2>/dev/null || true

# 13. A human server on another database is not reused.
(
	cd "$TEST_ROOT" || exit 1
	DEV_PORT=$HUMAN DATABASE_URL=postgres://localhost/old_db FAKE_NO_WORKERD=1 \
		node "$TEST_ROOT/node_modules/vite/bin/vite.js" >/dev/null 2>&1 &
	printf '%s\n' "$!" >"$TEST_ROOT/stale-human.pid"
)
STALE_HUMAN_PID=$(cat "$TEST_ROOT/stale-human.pid")
sleep 1
stale_human_out=$(DATABASE_URL=postgres://localhost/new_db run_agent start)
assert_contains "$stale_human_out" 'different DATABASE_URL' 'start warns about a stale human server'
assert_contains "$stale_human_out" 'shared agent dev server started' 'start falls back to shared for a stale human server'
run_agent stop-all >/dev/null
kill "$STALE_HUMAN_PID" 2>/dev/null || true

# 14. A human server on the same database is still reused.
(
	cd "$TEST_ROOT" || exit 1
	DEV_PORT=$HUMAN DATABASE_URL=postgres://localhost/same_db FAKE_NO_WORKERD=1 \
		node "$TEST_ROOT/node_modules/vite/bin/vite.js" >/dev/null 2>&1 &
	printf '%s\n' "$!" >"$TEST_ROOT/same-human.pid"
)
SAME_HUMAN_PID=$(cat "$TEST_ROOT/same-human.pid")
sleep 1
same_human_out=$(DATABASE_URL=postgres://localhost/same_db run_agent start)
assert_contains "$same_human_out" 'reused the human dev server' 'start reuses a human server on the same database'
kill "$SAME_HUMAN_PID" 2>/dev/null || true

if [ "$FAILS" -ne 0 ]; then
	printf '\nagent-dev: %s passed, %s failed\n' "$PASSES" "$FAILS"
	exit 1
fi

printf '\nagent-dev: %s passed, 0 failed\n' "$PASSES"
