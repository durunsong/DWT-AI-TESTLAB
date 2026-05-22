export const P0_STEP_TYPES = [
  "web_open",
  "web_reload",
  "web_input",
  "web_click",
  "web_select",
  "web_upload",
  "web_wait_text",
  "web_wait_element",
  "web_assert_text",
  "web_assert_visible",
  "web_assert_url",
  "web_extract",
  "web_screenshot",
  "flow_login",
  "flow_submit_kyc",
  "flow_admin_approve_kyc"
] as const;

export const P1_STEP_TYPES = [
  "api_request",
  "api_assert",
  "db_query",
  "db_assert",
  "db_clean"
] as const;

export const STEP_TYPES = [...P0_STEP_TYPES, ...P1_STEP_TYPES] as const;

export type StepType = (typeof STEP_TYPES)[number];
