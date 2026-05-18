import { z } from 'zod'

export const issueCreateSchema = z.object({
  title: z.string().min(2).max(120),
  sideALabel: z.string().min(1).max(40),
  sideASummary: z.string().min(1).max(500),
  sideBLabel: z.string().min(1).max(40),
  sideBSummary: z.string().min(1).max(500),
  opensAt: z.coerce.date(),
  closesAt: z.coerce.date(),
  resultAt: z.coerce.date(),
})

export const issueUpdateSchema = issueCreateSchema.partial()

export type IssueCreateInput = z.infer<typeof issueCreateSchema>
export type IssueUpdateInput = z.infer<typeof issueUpdateSchema>
