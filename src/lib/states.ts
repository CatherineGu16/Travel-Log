/** US states and territories by USPS code, for grouping and labels. */
export const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado', CT: 'Connecticut',
  DE: 'Delaware', DC: 'District of Columbia', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah',
  VT: 'Vermont', VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  AS: 'American Samoa', GU: 'Guam', MP: 'Northern Mariana Islands', PR: 'Puerto Rico', VI: 'U.S. Virgin Islands',
}

let countryNames: Intl.DisplayNames | null = null

/** "PT" → "Portugal", from the browser's own list. */
export const countryName = (code: string) => {
  try {
    countryNames ??= new Intl.DisplayNames(['en'], { type: 'region' })
    return countryNames.of(code) ?? code
  } catch {
    return code
  }
}

/**
 * For grouping and search: "US-CA" → "California"; a place abroad → its country ("Portugal"), since
 * regions outside the US aren't tracked yet; null or unknown in the US → "Other".
 */
export const regionName = (regionCode: string | null, countryCode = 'US') =>
  countryCode !== 'US' ? countryName(countryCode) : (regionCode && STATE_NAMES[regionCode.replace(/^US-/, '')]) || 'Other'
