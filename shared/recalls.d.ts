export type Recall = {
  campaignNumber: string | null
  component: string | null
  summary: string | null
  consequence: string | null
  remedy: string | null
  reportedDate: string | null
}
export function isRecallList(value: unknown): value is Recall[]
