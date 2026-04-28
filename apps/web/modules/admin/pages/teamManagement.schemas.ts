import { z } from "zod";

export const createTeamFormSchema = z.object({
  name: z.string().min(2, "Team name must be at least 2 characters"),
  description: z.string().optional(),
  color: z.string().default("#3B82F6"),
});

export const editTeamFormSchema = z.object({
  name: z.string().min(2, "Team name must be at least 2 characters"),
  description: z.string().optional(),
  color: z.string(),
});

export type CreateTeamFormData = z.infer<typeof createTeamFormSchema>;
export type EditTeamFormData = z.infer<typeof editTeamFormSchema>;
