// One runtime contract for cached and network recall records on web and iOS.
const recallFields = ['campaignNumber', 'component', 'summary', 'consequence', 'remedy', 'reportedDate']

export function isRecallList(value) {
  return Array.isArray(value) && value.every((item) => item && typeof item === 'object'
    && recallFields.every((key) => item[key] === null || typeof item[key] === 'string'))
}
