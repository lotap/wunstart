export function isPast(date: Date) {
	return date < new Date()
}

export function isFuture(date: Date) {
	return date > new Date()
}

/** @mutates date */
export function addMinutes(date: Date, minutes: number) {
	date.setMinutes(date.getMinutes() + minutes)
	return date
}

/** @mutates date */
export function subMinutes(date: Date, minutes: number) {
	date.setMinutes(date.getMinutes() - minutes)
	return date
}

/** @mutates date */
export function addWeeks(date: Date, weeks: number) {
	date.setDate(date.getDate() + weeks * 7)
	return date
}

export function differenceInSeconds(minuend: Date, subtrahend: Date) {
	return Math.trunc((minuend.getTime() - subtrahend.getTime()) / 1000)
}
