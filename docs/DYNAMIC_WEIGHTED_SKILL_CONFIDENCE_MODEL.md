# Dynamic Weighted Skill Confidence Model

## Purpose and scope

This document describes the YESGAP career-readiness scoring method and its current software implementation. It is a technical disclosure draft for engineering and possible patent-attorney review; it does not establish patentability, novelty, or legal claims. A provisional filing should be reviewed and prepared with qualified patent counsel.

The model replaces only the **career readiness percentage**. It does not redefine the portal's existing skill-completion percentage, skill-gap percentage, learning roadmap, assessment performance, practice performance, coding performance, consistency, or streak metrics. Those existing metrics remain separately calculated and are exposed separately from career readiness.

## Method

For a student with selected career domain `d`, let `R(d)` be the active skills linked to that domain with `required = true`. Each required skill `i` is scored with four terms:

- `W_i`: importance weight for that skill in that specific domain, from 1 through 5.
- `C_i`: confidence multiplier derived from the student's evidence-based readiness state.
- `F_i`: freshness factor from the most recent skill engagement.
- `M_i`: relative platform opportunity-demand multiplier computed from currently open opportunities on YESGAP that require the skill.

The per-skill score is:

```text
S_i = W_i × M_i × C_i × F_i
```

The maximum baseline for the selected domain assumes verified confidence, no freshness decay, and neutral relative platform demand (`M = 1`):

```text
B = Σ (W_i × C_verified) for every i in R(d)
```

The career-readiness percentage is:

```text
CareerReadiness = round(100 × Σ S_i / B)
CareerReadiness = clamp(CareerReadiness, 0, 100)
```

An empty required-skill set has `B = 0` and returns 0. The upper clamp handles relative-demand multipliers above 1. Skill-level `readinessContribution` in the API is `100 × S_i / B`; therefore, individual contributions sum to the unclamped total and can sum above 100 when relative platform demand raises the total above the baseline.

## Factor definitions

### 1. Domain-specific skill importance

`DomainSkill.importanceWeight` stores the weight on the skill-to-domain relationship, not on the global `Skill` record. This allows the same catalog skill to have a different value in each career domain. `DomainSkill.importanceLevel` records the administrator's Core or Supporting classification. Both are editable in the administrator Career domains screen. Importance is independent of the legacy `DomainSkill.weight`, which remains in use by existing skill-gap and completion calculations.

Current defaults: weights are in `[1, 5]`; seeded domain links use 5 for the first three ordered core skills and 3 for supporting skills. Existing links are backfilled at API startup from their sequence (`order < 3` becomes Core/5, otherwise Supporting/3). New links default to Supporting/3 unless configured by an administrator.

### 2. Evidence-based state confidence

`UserSkill.readinessState` separates readiness evidence from the legacy progress status. The supported states and default multipliers are:

| Readiness state | Meaning | Default multiplier |
| --- | --- | ---: |
| `missing` | No started learning or assessment evidence | 0.00 |
| `in-progress` | Learning has started, or skill is self-reported as known | 0.35 |
| `completed` | Learning material for the skill has been completed | 0.70 |
| `verified` | A qualifying assessment has been passed or a related coding submission has been accepted | 1.00 |

Administrators can adjust all four multipliers. The server validates that they strictly increase in the order shown. Legacy `known` records map to `in-progress` for readiness, because self-report alone is not equivalent to assessment verification. Existing `completed` and `in-progress` records map to their corresponding states. Passing assessments are stored as `readinessState = verified`; this does not overwrite the legacy `status` used by the skill-gap and completion metrics.

A submitted self-assessment verifies a skill when its percentage is at least `verificationPassPercentage` (default 70%); recruitment assessments do not count as self-study evidence. An accepted coding submission also verifies its associated skill. New assessment verification is persisted when the attempt is submitted. The score calculation infers qualifying historical assessment and coding evidence without writing to user records, allowing existing records to contribute without a destructive migration.

### 3. Freshness decay

The latest engagement timestamp is selected from the dedicated `SkillEngagement` record and available lesson, assessment, coding, practice-activity, and UserSkill history. The application records skill engagement when a student opens skill learning material, spends time in a lesson, submits practice, submits a coding challenge, or completes an assessment. Engagement refreshes the timer for the specific skill. Dashboard/readiness requests calculate freshness at request time; no scheduled decay job or stored decayed score is needed.

Let `D` be inactive days, `G` the grace period, `T` the linear decay duration after grace, and `L` the minimum freshness floor:

```text
x = clamp((D - G) / T, 0, 1)
F = max(L, 1 - (1 - L) × x)
```

If no reliable engagement timestamp exists, `F = 1` and the breakdown reports `inactiveDays = null`; this avoids penalizing a new or unmigrated record without evidence of inactivity. A missing skill still has zero confidence, so freshness cannot inflate its contribution.

Defaults: `G = 30 days`, `T = 120 days`, and `L = 0.50`. Administrators can configure each value. For example, with those defaults, a skill starts decaying after day 30 and reaches its 0.50 floor at day 150.

### 4. Relative platform opportunity-demand multiplier

This factor is a platform-local, catalog-relative signal. It is computed only from opportunity records in YESGAP and is not an external labor-market statistic or a claim about real-world demand. The scheduler counts how many distinct currently open opportunities from active, approved companies include each skill as a required skill. Expired opportunities are excluded. For each refresh, let `N_i` be that count and `N_max` the largest count across active catalog skills. First calculate the relative frequency `q_i = N_i / N_max`; then map its square root into the configured multiplier range:

```text
q_i = N_i / N_max
M_i = 1                                              if N_max = 0
M_i = M_min + (M_max - M_min) × sqrt(q_i)            otherwise
```

The square root moderates large frequency differences. `M_i` is a bounded transformation of `q_i`, not the raw opportunity-count ratio itself. With the default bounds (`0.75` and `1.50`), `M_i = 0.80` means the skill has fewer current platform opportunities than the highest-count skill; the precise count ratio is recovered from `q_i = ((M_i - M_min) / (M_max - M_min))²`. A value below 1.0 indicates a below-neutral multiplier under this configured mapping; it does not establish low demand in the external labor market. If there are no qualifying opportunities, the model uses neutral `M_i = 1.0` for every active catalog skill. Administrators configure the multiplier bounds. The scheduled refresh runs once at API startup and then every 24 hours; administrators can trigger an immediate refresh by saving model settings. The score request only reads the last materialized `SkillMarketDemand` values; it does not aggregate opportunities on each dashboard view. A skill without a materialized row uses neutral `1.0`.

## Configuration defaults

The singleton `ReadinessSettings` document stores global confidence values, freshness settings, verification threshold, and demand bounds. Administrator API endpoints are `GET /api/admin/readiness-settings` and `PUT /api/admin/readiness-settings`; access is admin-only. The Administrator workspace exposes the same settings under **Readiness model**.

| Setting | Default | Allowed range |
| --- | ---: | ---: |
| Missing confidence | 0.00 | 0–1 |
| In-progress confidence | 0.35 | 0–1, greater than missing |
| Completed confidence | 0.70 | 0–1, greater than in-progress |
| Verified confidence | 1.00 | 0.01–1, greater than completed |
| Freshness grace period | 30 days | 0–3650 days |
| Linear decay duration | 120 days | 1–3650 days |
| Freshness floor | 0.50 | 0–1 |
| Assessment verification threshold | 70% | 0–100% |
| Minimum relative-demand multiplier | 0.75 | 0.50–1.00 |
| Maximum relative-demand multiplier | 1.50 | 1.00–2.00, greater than minimum |
| Platform opportunity refresh interval | 24 hours | Operational scheduler interval |
| Importance weight | 3 (supporting) | 1–5 per skill-domain link |

## Explainability response

`GET /api/student/skill-gap` and the student dashboard include `careerReadiness`, `readinessBreakdown`, `readinessModel`, and `readinessCounts`. Each breakdown row includes the skill name and ID, domain importance and classification, readiness state, confidence multiplier, freshness factor, inactivity days and last engagement, relative platform-demand multiplier and qualifying opportunity count, raw weighted skill score, baseline contribution, and contribution percentage. The `readinessModel` object includes the model identifier, weighted total, maximum baseline, configuration snapshot, and last platform opportunity refresh timestamp. Student-facing labels describe this as relative demand within current YESGAP opportunities, not as an external job-market signal.

The roadmap endpoint continues to return the required skill sequence and now also carries the readiness percentage, the existing skill-gap and completion percentages, and the same score breakdown. It does not derive or overwrite those existing metrics from the new score.

## Processing sequence

1. Read the student's selected career domain and its required active domain-skill links.
2. Read the student's existing skill progress and relevant evidence timestamps.
3. Determine each required skill's evidence-based readiness state and configurable confidence multiplier.
4. Calculate freshness from that skill's latest engagement and the configured decay curve.
5. Read the latest scheduled relative platform-demand multiplier for that catalog skill.
6. Multiply the four factors by the domain-specific importance weight for each skill.
7. Sum skill scores, normalize by the verified-state baseline total, clamp to 0–100, and return a per-skill explanation.
8. Leave existing skill-gap, completion, learning, practice, coding, assessment, consistency, and roadmap ordering calculations independent.

## System components

- `ReadinessScoreService` performs the four-factor calculation and assembles the transparent breakdown.
- `SkillGapService` calls it and includes the resulting readiness value in the existing student dashboard and skill-gap response.
- `DomainSkill` owns per-domain importance metadata.
- `UserSkill` owns evidence-based readiness state while retaining legacy status/progress fields.
- `SkillEngagement` stores the latest per-user, per-skill engagement timestamp.
- `ReadinessSettings` stores administrator-controlled parameters.
- `SkillMarketDemand` stores the last scheduled eligible-opportunity count and relative platform-demand multiplier per catalog skill.
- The API startup scheduler periodically refreshes the relative signal from eligible YESGAP opportunity records; it does not ingest or represent external labor-market data.
