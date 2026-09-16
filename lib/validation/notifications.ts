import { z } from "zod";

// Aus app/api/notifications/send/route.ts ausgelagert, damit sowohl API-Routes
// als auch das Frontend (SendNotificationModal.tsx) dasselbe Schema nutzen.
export const sendNotificationSchema = z
  .object({
    contactIds: z.array(z.string().uuid()).min(1, "Mindestens ein Kontakt erforderlich."),
    type: z.enum(["email", "whatsapp", "both"]),
    emailPayload: z
      .object({
        subject: z.string().min(1, "Betreff erforderlich."),
        body: z.string().min(1, "Inhalt erforderlich."),
        isHtml: z.boolean().optional(),
      })
      .optional(),
    whatsappPayload: z
      .object({
        templateName: z.string().min(1, "Template-Name erforderlich."),
        languageCode: z.string().min(2).optional(),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if ((data.type === "email" || data.type === "both") && !data.emailPayload) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "emailPayload erforderlich für type 'email'/'both'.", path: ["emailPayload"] });
    }
    if ((data.type === "whatsapp" || data.type === "both") && !data.whatsappPayload) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "whatsappPayload erforderlich für type 'whatsapp'/'both'.", path: ["whatsappPayload"] });
    }
  });

export type SendNotificationInput = z.infer<typeof sendNotificationSchema>;

export const jobIdParamSchema = z.object({
  jobId: z.string().uuid("Ungültige Job-ID."),
});

export type JobIdParam = z.infer<typeof jobIdParamSchema>;
