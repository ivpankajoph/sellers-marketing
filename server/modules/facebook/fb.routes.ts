import { Router } from 'express';
import * as controller from './fb.controller';
import FlowLog from './flow.model.ts'
const router = Router();

router.post('/forms/sync', controller.syncForms);
router.get('/forms', controller.listForms);
router.get('/forms/:id', controller.getForm);
router.post('/forms/:formId/sync-leads', controller.syncLeads);
router.get('/leads', controller.listLeads);
router.get('/leads/:id', controller.getLead);

router.post("/flow-handler", async (req, res) => {
  try {
    const flowData = req.body;

    // Extract useful fields
    const wa_id = flowData?.user?.wa_id || null;
    const phone = flowData?.user?.phone || null;
    const flow_id = flowData?.flow_id || "unknown_flow";
    const step = flowData?.step || "unknown_step";

    const input =
      flowData?.step_data?.selected_option ||
      flowData?.step_data?.input_text ||
      null;

    // ---- Save to MongoDB ----
    await FlowLog.create({
      wa_id,
      phone,
      flow_id,
      step,
      input,
      raw_data: flowData,
    });

    console.log("Saved Flow Entry:", input);

    // ---- Response back to WhatsApp Flow ----
    return res.json({
      version: "1.0",
      data: {
        message: `Stored successfully! You entered: ${input}`,
        next_step: "SUCCESS_SCREEN",
      },
    });

  } catch (err) {
    console.error("Flow Error:", err);

    return res.status(500).json({
      version: "1.0",
      data: {
        message: "Database Error! Try again.",
        next_step: "ERROR_SCREEN",
      },
    });
  }
});


export default router;
