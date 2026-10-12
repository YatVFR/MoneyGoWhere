// Compatibility entry point: paylater-recurrence.js owns rule selection and
// synchronous preview updates. Restoring dropdown values after events would
// leave the preview inconsistent with the rule submitted by the form.
(()=>{'use strict';
window.MGWPayLaterRuleHotfix={version:window.MGW_RELEASE?.appVersion||'dev',handledBy:'paylater-recurrence'};
})();
