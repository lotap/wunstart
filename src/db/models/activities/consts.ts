/**
 * The threshold for deeming activities as "excessive."
 * If the sum of the weight of activities for a given scope exceeds this threshold in a given time, then the scope target should be rate-limited.
 *
 * The number is arbitrary and will need to be adjusted based on the usage/needs of your application.
 * 12,600 is a good starting point because it's evenly divisible by 1-10, 20 and 25.
 */
export const EXCESSIVE_ACTIVITIES_THRESHOLD = 12_600

export const EXCESSIVE_ACTIVITIES_WINDOW_INTERVAL = `10 minutes`

/** The weight used by default for successful activities */
export const ACTIVITIES_BASELINE_WEIGHT = EXCESSIVE_ACTIVITIES_THRESHOLD / 150
