# VIVI RESEARCH — secondary concept

**Direction:** “Don’t only ask people what they would do. Put them in the situation.” This is a separate, opt-in study product built on the same world, shot and modifier grammar. It should stay out of the consumer feed unless someone knowingly joins a study.

## Workflow

`CREATE SITUATION → DEFINE VARIABLES → RANDOMIZE VARIANTS → RUN STUDY → OBSERVE BEHAVIOR → COMPARE COHORTS`

A researcher starts from a consent-reviewed scenario, chooses one or two variables, previews all branches, sets eligibility and consent language, runs randomized variants, then sees aggregated paths, cue reach, decision latency and completion. The builder must warn when a variant changes more than its declared variable. Example: time pressure = none / 60s / 20s, with the same scene and choices. Another example: authority present = yes / no. Do not silently mix both and call it a clean effect.

## Schema groundwork

[`BehavioralContext`](../src/engine/modifiers/types.ts): scenario ID, variant ID, research opt-in, consent version and declared variables (`timePressure`, `socialPressure`, `ambiguity`, `closeness`, `authority`, `publicVisibility`, `financialStakes`, `risk`, `uncertainty`).

[`BehaviorEvent`](../src/engine/modifiers/types.ts): event name, scenario/variant, elapsed time, optional object/choice ID, decision latency and path sequence. Events include `cue_seen`, `object_inspected`, `npc_approached`, `interaction_started`, `interaction_abandoned`, `message_opened`, `decision_committed`, `choice_changed_before_commit`, `story_completed`. Identifiers should be pseudonymous for the study and separated from consumer identity.

## Design mockups

- [Experiment builder](../src/assets/research/experiment-builder.svg): scenario, variable matrix, preview and launch gate.
- [Study dashboard](../src/assets/research/study-dashboard.svg): aggregated paths, decision latency and cohort comparison.

The research interface shares Vivi’s paper, ink, rust and Newsreader display language, with denser mono labels and a more analytic grid. These are visual concepts, not implemented screens or a production analytics service.

## Privacy and governance

No hidden psychological profiling for sale. Participation needs explicit opt-in, a clear study purpose, appropriate consent, deletion and withdrawal paths, aggregation/anonymization before researcher views, access controls, retention limits and review for reidentification in small cohorts. Sell study execution and aggregated behavioral analysis, not identifiable personal profiles. The consumer app should neither emit the proposed events nor imply the study is running without an implemented consent flow.
