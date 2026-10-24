#!/bin/sh
# Agent dev-server lifecycle. Stateless by design: ports and process cwd are
# the only registry. Agents share one server by default, start extra fresh
# servers on demand, and never stop a human server. Servers exit on their own
# idle timer (vite.config.ts), so no lease or PID file can go stale.
set -u

DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
ROOT=$(CDPATH= cd -- "$DIR/../.." && pwd -P)
cd "$ROOT" || exit 1

# Keep in sync with tools/helpers/dev-ports.ts (a shell cannot import TS).
AGENT_MIN=3100
AGENT_MAX=3199
WIDTH=$((AGENT_MAX - AGENT_MIN + 1))
DOTENV="$ROOT/node_modules/.bin/dotenv"
DEPS_SCRIPT="$ROOT/tools/pkg-scripts/install-deps.sh"
SCRIPT_PATH="$DIR/agent-dev.sh"
SELF="sh tools/pkg-scripts/agent-dev.sh"

if [ -f bun.lock ] || [ -f bun.lockb ]; then
	PM_RUN="bun run"
elif [ -f package-lock.json ]; then
	PM_RUN="npm run"
elif [ -f pnpm-lock.yaml ]; then
	PM_RUN="pnpm run"
elif [ -f yarn.lock ]; then
	PM_RUN="yarn run"
elif [ -f aube-lock.yaml ]; then
	PM_RUN="aube run"
elif [ -f nub.lock ]; then
	PM_RUN="nub run"
else
	PM_RUN="bun run"
fi

usage() {
	cat <<'EOF'
usage: agent-dev <command> [options]

  start [--fresh]     reuse a human server in this worktree when there is
                      one, otherwise reuse or start the shared agent server.
                      --fresh starts an additional instance on its own port.
  status              list human and agent servers; TCP/process checks only
                      (does not reset idle timers), never kills anything
  stop --port <port>  stop a fresh agent server in this worktree
  stop-all            human cleanup: stop this worktree's agent servers
  -h, --help          this text

Agents: use `start`. Never stop a human server or the shared agent server.
The shared server and every fresh server exit after 15 minutes without an
HTTP request or file change (AGENT_DEV_IDLE_MS overrides the window).

--fresh is runtime isolation only: files, HMR, the git index, and the
database stay shared. Use a temporary worktree for real isolation.

Env: AGENT_DEV_MAX_SERVERS (default 4), AGENT_DEV_IDLE_MS (default 900000).
EOF
}

fail() {
	echo "FAIL $1" >&2
	if [ "$#" -ge 2 ]; then
		echo "hint: $2" >&2
	fi
	exit 1
}

is_number() {
	case "${1:-}" in
		'' | *[!0-9]*) return 1 ;;
		*) return 0 ;;
	esac
}

valid_port() {
	is_number "${1:-}" && [ "$1" -ge 1 ] && [ "$1" -le 65535 ]
}

in_agent_range() {
	is_number "${1:-}" && [ "$1" -ge "$AGENT_MIN" ] && [ "$1" -le "$AGENT_MAX" ]
}

require_port_vars() {
	if ! valid_port "${DEV_PORT:-}"; then
		fail "DEV_PORT is missing or invalid (${DEV_PORT:-unset})" "run: $PM_RUN branch-env (writes .env.local) — then re-run this command"
	fi

	if ! valid_port "${AGENT_DEV_PORT:-}"; then
		fail "AGENT_DEV_PORT is missing or invalid (${AGENT_DEV_PORT:-unset})" "run: $PM_RUN branch-env (writes .env.local) — then re-run this command"
	fi

	dev_port=$DEV_PORT
	agent_port=$AGENT_DEV_PORT

	if in_agent_range "$dev_port"; then
		fail "DEV_PORT=:$dev_port is inside the agent-only range :$AGENT_MIN-$AGENT_MAX" "pin the human server outside the range (default :3000) — then run: $PM_RUN branch-env"
	fi

	if ! in_agent_range "$agent_port"; then
		fail "AGENT_DEV_PORT=:$agent_port is outside the agent range :$AGENT_MIN-$AGENT_MAX" "run: $PM_RUN branch-env to claim an agent port — then re-run this command"
	fi

	if [ "$dev_port" -eq "$agent_port" ]; then
		fail "DEV_PORT and AGENT_DEV_PORT are both :$dev_port" "run: $PM_RUN branch-env to write distinct ports"
	fi
}

port_listening() {
	[ -n "$(listener_pids "$1")" ]
}

listener_pids() {
	lsof -ti ":$1" -sTCP:LISTEN 2>/dev/null | sort -u
}

first_listener_pid() {
	listener_pids "$1" | head -n 1
}

pid_listens() {
	listener_pids "$2" | grep -qx "$1"
}

# `port pid` pairs for listeners in the agent range, one lsof call.
range_listeners() {
	lsof -nP -iTCP:"$AGENT_MIN-$AGENT_MAX" -sTCP:LISTEN -Fpn 2>/dev/null |
		awk '
			/^p[0-9]+$/ { pid = substr($0, 2) }
			/^n/ {
				name = substr($0, 2)
				port = name
				sub(/^.*:/, "", port)
				if (pid != "" && port ~ /^[0-9]+$/) print port " " pid
			}
		' | sort -u | sort -n
}

pid_cwd() {
	if [ -L "/proc/$1/cwd" ]; then
		readlink "/proc/$1/cwd" 2>/dev/null
		return
	fi

	lsof -a -p "$1" -d cwd -Fn 2>/dev/null | awk '/^n/ { sub(/^n/, ""); print; exit }'
}

normalize_dir() {
	(CDPATH= cd -- "$1" 2>/dev/null && pwd -P) || printf '%s\n' "$1"
}

belongs_to_root() {
	[ -n "${1:-}" ] || return 1

	belong_path=$(normalize_dir "$1")

	case "$belong_path" in
		"$ROOT" | "$ROOT"/*) return 0 ;;
		*) return 1 ;;
	esac
}

pid_command() {
	ps -ww -p "$1" -o command= 2>/dev/null | head -n 1
}

pid_comm() {
	ps -p "$1" -o comm= 2>/dev/null | head -n 1
}

pid_exe_name() {
	exe_path=$(pid_comm "$1")

	[ -n "$exe_path" ] || return 1

	printf '%s\n' "${exe_path##*/}"
}

is_vite_command() {
	[ -n "${1:-}" ] || return 1

	printf '%s\n' "$1" | grep -Eq '(^|/)vite\.js($|[[:space:]])|/\.bin/vite($|[[:space:]])|/vite/bin/vite($|[[:space:]])'
}

agent_server_cap() {
	cap=${AGENT_DEV_MAX_SERVERS:-4}

	if ! is_number "$cap" || [ "$cap" -le 0 ]; then
		cap=4
	fi

	printf '%s\n' "$cap"
}

# Best-effort under concurrent starts: the cap is a guardrail, not a lease.
enforce_agent_cap() {
	cap=$(agent_server_cap)
	active=$(count_active_agent_servers)

	if [ "$active" -ge "$cap" ]; then
		fail "agent server cap reached ($active of $cap active in this worktree)" "see: $SELF status — stop a fresh server: $SELF stop --port <port>; raise AGENT_DEV_MAX_SERVERS; stop-all is human cleanup"
	fi
}

pid_ppid() {
	ps -p "$1" -o ppid= 2>/dev/null | tr -d ' '
}

# A real workerd/miniflare executable, not an argument that happens to
# contain the word (rg, an editor, a shell). Node-run miniflare scripts are
# the one interpreter case worth recognizing.
is_workerd_process() {
	workerd_process_pid=$1
	workerd_process_cmd=$2
	workerd_exe=$(pid_exe_name "$workerd_process_pid") || return 1

	case "$workerd_exe" in
		workerd | miniflare) return 0 ;;
		node | nodejs | bun | nub)
			case "$workerd_process_cmd" in
				*"$ROOT"/*miniflare*) return 0 ;;
			esac
			;;
	esac

	return 1
}

# Walk the parent chain for a Vite process rooted in this worktree. Wrapper
# shells between Vite and workerd still prove ownership; a wrangler parent
# does not.
has_vite_ancestor() {
	ancestor_pid=$1
	ancestor_depth=0

	while [ -n "$ancestor_pid" ] && [ "$ancestor_pid" != "0" ] && [ "$ancestor_pid" != "1" ] && [ "$ancestor_depth" -lt 10 ]; do
		if is_vite_command "$(pid_command "$ancestor_pid")" && belongs_to_root "$(pid_cwd "$ancestor_pid")"; then
			return 0
		fi

		ancestor_pid=$(pid_ppid "$ancestor_pid")
		ancestor_depth=$((ancestor_depth + 1))
	done

	return 1
}

# workerd/miniflare processes owned by this worktree: the executable and the
# app's dependency path matter (a scratch copy named workerd is not a server).
# Ownership is PPID 1 (Vite crashed), a dead parent, or a verified Vite
# ancestor. A live wrangler parent is not ours.
workerd_pids() {
	pgrep -f 'workerd|miniflare' 2>/dev/null | while read -r workerd_pid; do
		workerd_cmd=$(pid_command "$workerd_pid")

		case "$workerd_cmd" in
			*"$ROOT"/node_modules/*@cloudflare/workerd* | *"$ROOT"/node_modules/*miniflare*) ;;
			*) continue ;;
		esac

		is_workerd_process "$workerd_pid" "$workerd_cmd" || continue

		workerd_ppid=$(pid_ppid "$workerd_pid")

		if [ "$workerd_ppid" = "1" ] || [ -z "$workerd_ppid" ] || ! kill -0 "$workerd_ppid" 2>/dev/null || has_vite_ancestor "$workerd_ppid"; then
			printf '%s\n' "$workerd_pid"
		fi
	done
}

# Orphans: the parent is gone (PID 1 or already dead). A live Vite ancestor
# still owns the worker; a live non-Vite parent is not ours to kill.
orphan_workerd_pids() {
	for workerd_pid in $(workerd_pids); do
		workerd_ppid=$(pid_ppid "$workerd_pid")

		if [ "$workerd_ppid" = "1" ] || [ -z "$workerd_ppid" ] || ! kill -0 "$workerd_ppid" 2>/dev/null; then
			printf '%s\n' "$workerd_pid"
		fi
	done
}

# Environment value for a live process: exact on Linux, `ps eww` on macOS.
# Used only for agent identity; values may hold credentials and are never
# printed.
pid_env_value() {
	env_pid=$1
	env_key=$2

	if [ -r "/proc/$env_pid/environ" ]; then
		tr '\0' '\n' <"/proc/$env_pid/environ" | sed -n "s/^${env_key}=//p" | head -n 1
		return 0
	fi

	ps eww -p "$env_pid" -o command= 2>/dev/null |
		sed -n "s/.* ${env_key}=\([^ ]*\).*/\1/p" | head -n 1
}

pid_is_agent_for_port() {
	check_pid=$1
	check_port=$2

	[ "$(pid_env_value "$check_pid" DEV_ROLE)" = "agent" ] &&
		[ "$(pid_env_value "$check_pid" AGENT_DEV_PORT)" = "$check_port" ]
}

pid_has_current_database() {
	[ "$(pid_env_value "$1" DATABASE_URL)" = "${DATABASE_URL:-}" ]
}

pid_is_shared_agent_for_port() {
	pid_is_agent_for_port "$1" "$2" && pid_has_current_database "$1"
}

# Agent Vite processes in this worktree, including a wedged one that no
# longer holds its listener. DEV_ROLE=agent is the ownership proof; the
# port comes from the process env so stop-all can report it.
agent_vite_pids() {
	pgrep -f 'vite\.js|/\.bin/vite|/vite/bin/vite' 2>/dev/null | while read -r vite_pid; do
		vite_cmd=$(pid_command "$vite_pid")

		is_vite_command "$vite_cmd" || continue
		[ "$(pid_env_value "$vite_pid" DEV_ROLE)" = "agent" ] || continue
		belongs_to_root "$(pid_cwd "$vite_pid")" || continue

		vite_env_port=$(pid_env_value "$vite_pid" AGENT_DEV_PORT)

		if in_agent_range "$vite_env_port"; then
			printf '%s %s\n' "$vite_env_port" "$vite_pid"
		else
			printf '%s %s\n' "-" "$vite_pid"
		fi
	done
}

agent_vite_pids_for_port() {
	agent_vite_pids | awk -v want_port="$1" '$1 == want_port { print $2 }'
}

agent_vite_port_in_use() {
	[ -n "$(agent_vite_pids_for_port "$1")" ]
}

stop_pid_set() {
	set_pids=$1
	set_timeout=${2:-10}

	for set_pid in $set_pids; do
		stop_pid "$set_pid" "$set_timeout"
	done

	sleep 1

	for set_pid in $set_pids; do
		if kill -0 "$set_pid" 2>/dev/null; then
			kill -KILL "$set_pid" 2>/dev/null || true
		fi
	done
}

stop_orphan_workerd() {
	orphan_pids=$(orphan_workerd_pids | sort -u)

	[ -n "$orphan_pids" ] || return 0

	echo "stopping orphaned workerd process(es): $(printf '%s\n' "$orphan_pids" | tr '\n' ' ')" >&2
	stop_pid_set "$orphan_pids" 5
}

http_healthy() {
	curl -fsS --max-time 2 -o /dev/null "http://localhost:$1/" 2>/dev/null
}

show_log_tail() {
	if [ -f "$1" ]; then
		tail -n 50 "$1" >&2
	fi
}

install_deps() {
	echo "...  checking dependencies…" >&2

	if ! sh "$DEPS_SCRIPT"; then
		fail "dependency freshness step failed" "fix the install error above, then re-run this command"
	fi
}

start_vite() {
	start_port=$1
	start_log=$2

	# A previous hard-killed Vite leaves workerd reparented to PID 1; clear
	# that leak before adding another server.
	stop_orphan_workerd

	# A live Vite without a listener can still own the port and Cloudflare
	# state. Do not start a second server on top of it; its owner (or human
	# cleanup for a shared server) has to stop it first.
	if ! port_listening "$start_port" && agent_vite_port_in_use "$start_port"; then
		if [ "$start_port" -eq "$agent_port" ]; then
			fail "the shared agent Vite is already running on :$start_port without a listener" "inspect: $SELF status — the shared server is human cleanup; ask a human to run: $SELF stop-all"
		fi

		fail "an agent Vite is already running on :$start_port without a listener" "inspect: $SELF status — stop it: $SELF stop --port $start_port"
	fi

	mkdir -p "$(dirname "$start_log")" || fail "could not create $start_log" "check .tmp/ permissions, then re-run"

	if [ ! -f "$ROOT/node_modules/vite/bin/vite.js" ]; then
		fail "vite is not installed" "run: $PM_RUN install-deps — then re-run this command"
	fi

	if command -v node >/dev/null 2>&1; then
		vite_runtime=node
	elif command -v bun >/dev/null 2>&1; then
		vite_runtime=bun
	elif command -v nub >/dev/null 2>&1; then
		vite_runtime=nub
	else
		fail "no JavaScript runtime found for vite" "install node 22.18+ or bun — then re-run this command"
	fi

	DEV_ROLE=agent AGENT_DEV_PORT="$start_port" nohup "$vite_runtime" "$ROOT/node_modules/vite/bin/vite.js" dev >"$start_log" 2>&1 &
	STARTED_PID=$!
}

wait_health() {
	wait_port=$1
	wait_pid=${2:-}
	wait_tries=${3:-60}
	wait_i=0

	while [ "$wait_i" -lt "$wait_tries" ]; do
		if http_healthy "$wait_port"; then
			return 0
		fi

		if [ -n "$wait_pid" ] && ! kill -0 "$wait_pid" 2>/dev/null; then
			return 1
		fi

		sleep 1
		wait_i=$((wait_i + 1))
	done

	return 1
}

stop_pid() {
	stop_target=$1
	stop_timeout=${2:-10}
	stop_i=0

	kill -TERM "$stop_target" 2>/dev/null || return 0

	while kill -0 "$stop_target" 2>/dev/null; do
		if [ "$stop_i" -ge "$stop_timeout" ]; then
			kill -KILL "$stop_target" 2>/dev/null || true
			break
		fi

		sleep 1
		stop_i=$((stop_i + 1))
	done
}

stop_started_child() {
	child_pid=$1

	if kill -0 "$child_pid" 2>/dev/null; then
		stop_pid "$child_pid" 10
	fi

	wait "$child_pid" 2>/dev/null || true
	stop_orphan_workerd
}

is_bind_race() {
	grep -Eq 'EADDRINUSE|[Pp]ort [0-9]+ is already in use' "$1" 2>/dev/null
}

reuse_human() {
	if ! port_listening "$dev_port"; then
		return 1
	fi

	for human_pid in $(listener_pids "$dev_port"); do
		human_cwd=$(pid_cwd "$human_pid")

		if belongs_to_root "$human_cwd" && is_vite_command "$(pid_command "$human_pid")"; then
			if ! pid_has_current_database "$human_pid"; then
				echo "WARN human dev server on :$dev_port is using a different DATABASE_URL; not reusing it" >&2
				echo "hint: restart it with: $PM_RUN dev — using a shared agent server instead" >&2
				continue
			fi

			if wait_health "$dev_port" "" 10; then
				printf 'http://localhost:%s\n' "$dev_port"
				echo "reused the human dev server in this worktree (pid $human_pid); no agent server started"
				return 0
			fi
		fi
	done

	return 1
}

reuse_shared() {
	if ! port_listening "$agent_port"; then
		return 1
	fi

	for shared_pid in $(listener_pids "$agent_port"); do
		shared_cwd=$(pid_cwd "$shared_pid")

		if belongs_to_root "$shared_cwd"; then
			if ! is_vite_command "$(pid_command "$shared_pid")"; then
				fail "listener on :$agent_port is not a Vite dev server (pid $shared_pid)" "do not kill it — inspect with: $SELF status"
			fi

			if ! pid_is_agent_for_port "$shared_pid" "$agent_port"; then
				fail "listener on :$agent_port is not this worktree's shared agent Vite (pid $shared_pid)" "do not kill it — inspect with: $SELF status, or start a separate server: $SELF start --fresh"
			fi

			if ! pid_is_shared_agent_for_port "$shared_pid" "$agent_port"; then
				fail "shared agent server on :$agent_port is using a different database" "do not kill it — ask a human to run: $SELF stop-all, then re-run"
			fi

			if wait_health "$agent_port" "" 10; then
				printf 'http://localhost:%s\n' "$agent_port"
				echo "reused the shared agent dev server in this worktree (pid $shared_pid)"
				return 0
			fi

			fail "shared agent server on :$agent_port is listening but not answering HTTP" "check .tmp/agent-dev/$agent_port.log, or run: $SELF status"
		fi
	done

	owner_pid=$(first_listener_pid "$agent_port")
	owner_cwd=$(pid_cwd "$owner_pid")
	fail "agent dev port :$agent_port is held by another worktree (${owner_cwd:-unknown cwd})" "do not kill it — run: $SELF start --fresh, or free :$agent_port in that worktree"
}

next_free_agent_port() {
	next_start=$1
	next_offset=0
	process_ports=$(agent_vite_pids | awk '$1 != "-" { print $1 }' | sort -u | tr '\n' ' ')

	while [ "$next_offset" -lt "$WIDTH" ]; do
		next_port=$((AGENT_MIN + ((next_start - AGENT_MIN + next_offset) % WIDTH)))
		next_offset=$((next_offset + 1))

		if [ "$next_port" -eq "$agent_port" ] || [ "$next_port" -eq "$dev_port" ]; then
			continue
		fi

		case " $process_ports " in
			*" $next_port "*) continue ;;
		esac

		if ! port_listening "$next_port"; then
			printf '%s\n' "$next_port"
			return 0
		fi
	done

	return 1
}

count_active_agent_servers() {
	range_listeners | {
		active_count=0

		while read -r count_port count_pid; do
			[ -n "$count_port" ] || continue
			[ "$count_port" -eq "$dev_port" ] && continue

			if belongs_to_root "$(pid_cwd "$count_pid")"; then
				active_count=$((active_count + 1))
			fi
		done

		printf '%s\n' "$active_count"
	}
}

start_shared() {
	enforce_agent_cap
	install_deps

	shared_log=".tmp/agent-dev/$agent_port.log"
	start_vite "$agent_port" "$shared_log"
	shared_child=$STARTED_PID

	if wait_health "$agent_port" "$shared_child" 60; then
		sleep 1

		if kill -0 "$shared_child" 2>/dev/null && pid_listens "$shared_child" "$agent_port"; then
			printf 'http://localhost:%s\n' "$agent_port"
			echo "shared agent dev server started (pid $shared_child)"
			echo "port: $agent_port"
			echo "log: $shared_log"
			echo "idle: exits after the configured idle window (default 15 minutes; AGENT_DEV_IDLE_MS overrides)"
			echo "shared server: do not stop it; it idle-expires"
			return 0
		fi
	fi

	# Another agent may have won the bind while this one was starting.
	if port_listening "$agent_port"; then
		for race_pid in $(listener_pids "$agent_port"); do
			if belongs_to_root "$(pid_cwd "$race_pid")" && is_vite_command "$(pid_command "$race_pid")" && pid_is_shared_agent_for_port "$race_pid" "$agent_port" && wait_health "$agent_port" "" 20; then
				stop_started_child "$shared_child"
				printf 'http://localhost:%s\n' "$agent_port"
				echo "another agent won the bind on :$agent_port; reused its server (pid $race_pid)"
				return 0
			fi
		done
	fi

	show_log_tail "$shared_log"
	stop_started_child "$shared_child"

	if port_listening "$agent_port"; then
		owner_pid=$(first_listener_pid "$agent_port")
		owner_cwd=$(pid_cwd "$owner_pid")

		if ! belongs_to_root "$owner_cwd"; then
			fail "agent dev port :$agent_port is held by another worktree (${owner_cwd:-unknown cwd})" "do not kill it — run: $SELF start --fresh, or free :$agent_port in that worktree"
		fi
	fi

	fail "agent dev server did not become healthy on :$agent_port" "see the log tail above, then run: $SELF status"
}

start_fresh() {
	enforce_agent_cap

	fresh_port=$(next_free_agent_port $((agent_port + 1))) || fail "no free agent port in :$AGENT_MIN-$AGENT_MAX" "stop an unused agent server with status, then re-run"

	install_deps

	attempt=0

	while [ "$attempt" -lt "$WIDTH" ]; do
		attempt=$((attempt + 1))

		fresh_log=".tmp/agent-dev/$fresh_port.log"
		start_vite "$fresh_port" "$fresh_log"
		fresh_child=$STARTED_PID

		if wait_health "$fresh_port" "$fresh_child" 60; then
			sleep 1

			if kill -0 "$fresh_child" 2>/dev/null && pid_listens "$fresh_child" "$fresh_port"; then
				printf 'http://localhost:%s\n' "$fresh_port"
				echo "fresh agent dev server started (pid $fresh_child)"
				echo "port: $fresh_port"
				echo "log: $fresh_log"
				echo "stop: $SELF stop --port $fresh_port"
				echo "idle: exits after the configured idle window (default 15 minutes; AGENT_DEV_IDLE_MS overrides)"
				echo "note: files, HMR, git, and the database are shared with other servers"
				return 0
			fi
		fi

		if is_bind_race "$fresh_log"; then
			stop_started_child "$fresh_child"
			fresh_port=$(next_free_agent_port $((fresh_port + 1))) || break
			continue
		fi

		if ! kill -0 "$fresh_child" 2>/dev/null; then
			show_log_tail "$fresh_log"
			wait "$fresh_child" 2>/dev/null || true
			stop_orphan_workerd
			fail "agent dev server failed to start on :$fresh_port" "see the log tail above, then run: $SELF status"
		fi

		show_log_tail "$fresh_log"
		stop_started_child "$fresh_child"
		fail "agent dev server did not become healthy on :$fresh_port" "see the log tail above, then run: $SELF status"
	done

	fail "no free agent port in :$AGENT_MIN-$AGENT_MAX (bind races exhausted the range)" "run: $SELF status — free an unused agent server, then re-run"
}

status_line() {
	line_port=$1
	line_pid=$2
	line_role=$3
	line_log=$4
	line_cwd=$(pid_cwd "$line_pid")

	if [ -z "$line_cwd" ]; then
		line_own=unknown
	elif belongs_to_root "$line_cwd"; then
		line_own=yes
	else
		line_own=no
	fi

	printf '%-6s %-7s %-9s %-7s %s\n' "$line_port" "$line_pid" "$line_own" "$line_role" "$line_log"
}

status_output() {
	{
		for status_pid in $(listener_pids "$dev_port"); do
			if is_vite_command "$(pid_command "$status_pid")"; then
				status_role=human
			else
				status_role=other
			fi

			status_line "$dev_port" "$status_pid" "$status_role" ".tmp/dev.log"
		done

		range_listeners | while read -r status_port status_pid; do
			[ -n "$status_port" ] || continue
			[ "$status_port" -eq "$dev_port" ] && continue

			if ! is_vite_command "$(pid_command "$status_pid")"; then
				status_role=other
			elif ! pid_is_agent_for_port "$status_pid" "$status_port"; then
				status_role=other
			elif [ "$status_port" -eq "$agent_port" ]; then
				status_role=shared
			else
				status_role=fresh
			fi

			status_line "$status_port" "$status_pid" "$status_role" ".tmp/agent-dev/$status_port.log"
		done

		# Agent Vite processes that lost their listener are still running;
		# show them so they are visible and stoppable.
		agent_vite_pids | while read -r status_port status_pid; do
			case "$status_port" in
				-) status_role=agent; status_log=- ;;
				"$agent_port")
					status_role=shared
					status_log=".tmp/agent-dev/$status_port.log"
					;;
				*)
					status_role=fresh
					status_log=".tmp/agent-dev/$status_port.log"
					;;
			esac

			status_line "$status_port" "$status_pid" "$status_role" "$status_log"
		done

		for orphan_pid in $(orphan_workerd_pids); do
			status_line "-" "$orphan_pid" workerd "-"
		done
	} | awk '!seen[$2]++'
}

status() {
	require_port_vars

	status_rows=$(status_output)

	echo "configured: human :$dev_port, shared agent :$agent_port"

	if [ -z "$status_rows" ]; then
		echo "no dev servers listening in this worktree"
		return 0
	fi

	printf '%-6s %-7s %-9s %-7s %s\n' port pid worktree role log
	printf '%s\n' "$status_rows"
}

stop_port_value() {
	stop_requested=$1

	if ! valid_port "$stop_requested"; then
		fail "invalid --port ${stop_requested:-<missing>}" "pass: --port <1-65535>"
	fi

	if [ "$stop_requested" -eq "$dev_port" ]; then
		fail "refusing to stop the human dev server on :$stop_requested" "agent commands never stop the human server"
	fi

	if [ "$stop_requested" -eq "$agent_port" ]; then
		fail "refusing to stop the shared agent server on :$stop_requested" "the shared server idle-expires; this command stops --fresh servers only"
	fi

	if ! in_agent_range "$stop_requested"; then
		fail "stop --port is for fresh agent servers in :$AGENT_MIN-$AGENT_MAX (got :$stop_requested)" "see: $SELF status"
	fi

	listener_stop_pids=$(listener_pids "$stop_requested")
	process_stop_pids=$(agent_vite_pids_for_port "$stop_requested")
	stop_pids=$(printf '%s\n%s\n' "$listener_stop_pids" "$process_stop_pids" | sed '/^$/d' | sort -u)

	if [ -z "$stop_pids" ]; then
		# A crashed Vite may have left workerd with no listener; this is the
		# agent-allowed cleanup path for that case.
		stop_orphan_workerd
		echo "nothing listening on :$stop_requested"
		return 0
	fi

	# Validate listeners here. Process-scan hits were already checked for
	# cwd, Vite identity, role, and env port by agent_vite_pids_for_port.
	for stop_target in $listener_stop_pids; do
		stop_cwd=$(pid_cwd "$stop_target")

		if ! belongs_to_root "$stop_cwd"; then
			fail "listener on :$stop_requested is not in this worktree (cwd: ${stop_cwd:-unknown})" "do not kill another worktree's server — see: $SELF status"
		fi

		if ! is_vite_command "$(pid_command "$stop_target")"; then
			fail "listener on :$stop_requested is not a Vite dev server (pid $stop_target)" "refusing to kill it — inspect with: $SELF status"
		fi

		if ! pid_is_agent_for_port "$stop_target" "$stop_requested"; then
			fail "listener on :$stop_requested is not an agent Vite for that port (pid $stop_target)" "refusing to kill it — inspect with: $SELF status"
		fi
	done

	stop_pid_set "$stop_pids" 10
	stop_orphan_workerd

	echo "stopped fresh agent dev server on :$stop_requested"
}

stop_all() {
	dev_port=

	if [ -f .env.local ]; then
		# stop-all runs before dotenv; read the one exclusion it needs directly.
		local_dev_port=$(sed -n "s/^DEV_PORT=[\"']*\([0-9][0-9]*\)[\"']*$/\1/p" .env.local | tail -n 1)

		if valid_port "$local_dev_port"; then
			dev_port=$local_dev_port
		fi
	fi

	if ! valid_port "$dev_port" && valid_port "${DEV_PORT:-}"; then
		dev_port=$DEV_PORT
	fi

	listener_targets=$(range_listeners | while read -r all_port all_pid; do
		[ -n "$all_port" ] || continue

		if [ -n "$dev_port" ] && [ "$all_port" -eq "$dev_port" ]; then
			continue
		fi

		belongs_to_root "$(pid_cwd "$all_pid")" || continue
		is_vite_command "$(pid_command "$all_pid")" || continue
		pid_is_agent_for_port "$all_pid" "$all_port" || continue

		printf '%s %s\n' "$all_port" "$all_pid"
	done)
	# A wedged agent Vite can still be alive without its listener; the
	# listener scan alone would miss it (and its workerd child).
	process_targets=$(agent_vite_pids)
	targets=$(printf '%s\n%s\n' "$listener_targets" "$process_targets" | sed '/^$/d' | sort -u)

	orphans=$(orphan_workerd_pids | sort -u)

	if [ -z "$targets" ] && [ -z "$orphans" ]; then
		echo "no agent dev servers to stop in this worktree"
		return 0
	fi

	if [ -n "$targets" ]; then
		printf '%s\n' "$targets" | while read -r all_port all_pid; do
			if [ "$all_port" = "-" ]; then
				echo "stopping agent dev server (pid $all_pid)" >&2
			else
				echo "stopping :$all_port (pid $all_pid)" >&2
			fi
		done

		all_pids=$(printf '%s\n' "$targets" | awk '{print $2}' | sort -u)
		stop_pid_set "$all_pids" 10
	fi

	# A hard-killed Vite leaves workerd reparented to PID 1. Rescan after the
	# listeners are gone; a live human server keeps its workerd child.
	orphans=$( { printf '%s\n' "$orphans"; orphan_workerd_pids; } | sed '/^$/d' | sort -u)

	if [ -n "$orphans" ]; then
		echo "stopping orphaned workerd process(es): $(printf '%s\n' "$orphans" | tr '\n' ' ')" >&2
		stop_pid_set "$orphans" 5
	fi

	echo "stopped this worktree's agent dev servers"
}

for arg in "$@"; do
	case "$arg" in
		-h | --help)
			usage
			exit 0
			;;
	esac
done

if [ "${1:-}" = "" ] || [ "${1:-}" = "help" ]; then
	usage
	exit 0
fi

# stop-all is cleanup: it must run even when dependencies or .env loading is
# broken. It only needs lsof/ps and the optional DEV_PORT exclusion.
if [ "${1:-}" = "stop-all" ]; then
	if [ "$#" -gt 1 ]; then
		fail "stop-all takes no options" "see: $SELF --help"
	fi

	stop_all
	exit 0
fi

# An argument, not an env var: .env.local can set arbitrary keys, so a marker
# variable would be user-overridable.
env_loaded=0

if [ "${1:-}" = "__wunstart_agent_dev_env_loaded" ]; then
	env_loaded=1
	shift
fi

# Load the same two files the dev/db scripts load (development then local,
# local winning) before any port or path decision.
if [ "$env_loaded" -ne 1 ]; then
	if [ ! -x "$DOTENV" ]; then
		if [ "${1:-}" = "start" ]; then
			echo "...  dependencies are missing — provisioning so .env files can load…" >&2
			sh "$DEPS_SCRIPT" || fail "dependency provisioning failed" "fix the install error above, then re-run this command"
		else
			fail "dependencies are missing (node_modules/.bin/dotenv not found)" "run: $PM_RUN install-deps — then re-run this command"
		fi
	fi

	if [ ! -x "$DOTENV" ]; then
		fail "dependencies are still missing (node_modules/.bin/dotenv not found)" "run: $PM_RUN install-deps — then re-run this command"
	fi

	if [ -f .env.local ]; then
		exec "$DOTENV" -e .env.development -e .env.local --override -- sh "$SCRIPT_PATH" __wunstart_agent_dev_env_loaded "$@"
	fi

	exec "$DOTENV" -e .env.development --override -- sh "$SCRIPT_PATH" __wunstart_agent_dev_env_loaded "$@"
fi

command_name=${1:-}
[ "$#" -gt 0 ] && shift

case "$command_name" in
	start)
		fresh=0

		while [ "$#" -gt 0 ]; do
			case "$1" in
				--fresh) fresh=1 ;;
				*) fail "unknown option for start: $1" "see: $SELF --help" ;;
			esac
			shift
		done

		require_port_vars

		if [ "$fresh" -eq 1 ]; then
			start_fresh
			exit 0
		fi

		if reuse_human; then
			exit 0
		fi

		if reuse_shared; then
			exit 0
		fi

		start_shared
		exit 0
		;;
	status)
		if [ "$#" -gt 0 ]; then
			fail "status takes no options" "see: $SELF --help"
		fi

		status
		;;
	stop)
		stop_port=

		while [ "$#" -gt 0 ]; do
			case "$1" in
				--port)
					[ "$#" -ge 2 ] || fail "--port needs a value" "pass: --port <1-65535>"
					stop_port=$2
					shift
					;;
				--port=*) stop_port=${1#*=} ;;
				*) fail "unknown option for stop: $1" "see: $SELF --help" ;;
			esac
			shift
		done

		[ -n "$stop_port" ] || fail "stop needs --port <port>" "see: $SELF status"

		require_port_vars
		stop_port_value "$stop_port"
		;;
	stop-all)
		if [ "$#" -gt 0 ]; then
			fail "stop-all takes no options" "see: $SELF --help"
		fi

		stop_all
		;;
	'' | help)
		usage
		;;
	*)
		fail "unknown command: $command_name" "see: $SELF --help"
		;;
esac
