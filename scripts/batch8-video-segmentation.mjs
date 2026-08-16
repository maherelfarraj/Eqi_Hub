import { createHash } from "node:crypto";

const GROUP_KEYS = ["source_video_ref", "horse_group_ref", "rider_group_ref", "arena_group_ref", "camera_group_ref", "recording_session_ref"];
const SPLITS = ["train", "validation", "test", "golden"];
const REQUIRED_REJECTION_CODES = [
  "invalid-input",
  "capture-not-eligible",
  "metadata-not-preserved",
  "timestamps-not-monotonic",
  "window-out-of-bounds",
  "window-order-invalid",
  "insufficient-context",
  "overlapping-windows",
  "dataset-leakage",
];
const SENSITIVE_KEY = /(?:password|secret|token|api[_-]?key|credential|email|full[_-]?name|phone|user[_-]?id)/i;

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function syntheticRef(value, prefix) {
  return typeof value === "string" && new RegExp(`^${prefix}-[a-z0-9-]+$`).test(value);
}

function rejectSensitiveKeys(value, path, errors) {
  if (Array.isArray(value)) return value.forEach((entry, index) => rejectSensitiveKeys(entry, `${path}[${index}]`, errors));
  if (!object(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) errors.push(`${path}.${key} must not contain credentials or personal data`);
    rejectSensitiveKeys(entry, `${path}.${key}`, errors);
  }
}

function stableHash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (object(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function chooseSplit(componentKey, ratios) {
  const bucket = Number.parseInt(stableHash(componentKey).slice(0, 8), 16) / 0x100000000;
  let cumulative = 0;
  for (const split of SPLITS) {
    cumulative += ratios[split];
    if (bucket < cumulative) return split;
  }
  return "golden";
}

export function validateBatch8Config(config) {
  const errors = [];
  if (!object(config)) return ["config must be an object"];
  if (config.version !== 1) errors.push("version must equal 1");
  if (config.batch !== 8) errors.push("batch must equal 8");
  if (config.mode !== "offline-video-segmentation-lineage") errors.push("mode must equal offline-video-segmentation-lineage");
  if (config.status !== "accepted") errors.push("status must equal accepted");

  const context = config.context;
  if (!object(context)) errors.push("context must be an object");
  else {
    if (!Number.isInteger(context.minimum_strides_before) || context.minimum_strides_before < 3) errors.push("context.minimum_strides_before must be at least 3");
    if (!Number.isInteger(context.minimum_strides_after) || context.minimum_strides_after < 2) errors.push("context.minimum_strides_after must be at least 2");
  }

  if (!Array.isArray(config.grouping_keys)) errors.push("grouping_keys must be an array");
  else GROUP_KEYS.forEach((key) => {
    if (!config.grouping_keys.includes(key)) errors.push(`grouping_keys must include ${key}`);
  });

  const ratios = config.split_ratios;
  if (!object(ratios)) errors.push("split_ratios must be an object");
  else {
    for (const split of SPLITS) if (!finite(ratios[split]) || ratios[split] <= 0 || ratios[split] >= 1) errors.push(`split_ratios.${split} must be between 0 and 1`);
    if (SPLITS.every((split) => finite(ratios[split])) && Math.abs(SPLITS.reduce((sum, split) => sum + ratios[split], 0) - 1) > 1e-9) errors.push("split_ratios must sum to 1");
  }

  if (!Array.isArray(config.rejection_codes)) errors.push("rejection_codes must be an array");
  else REQUIRED_REJECTION_CODES.forEach((code) => {
    if (!config.rejection_codes.includes(code)) errors.push(`rejection_codes must include ${code}`);
  });

  const safety = config.safety ?? {};
  for (const key of ["fail_closed", "immutable_lineage", "related_sources_same_split"]) if (safety[key] !== true) errors.push(`safety.${key} must equal true`);
  for (const key of ["production_data_allowed", "user_visible_results", "model_inference", "database_changes"]) if (safety[key] !== false) errors.push(`safety.${key} must equal false`);

  if (!Array.isArray(config.fixtures) || config.fixtures.length < 3) errors.push("fixtures must contain at least three synthetic cases");
  else {
    const refs = new Set();
    const decisions = new Set();
    config.fixtures.forEach((fixture, index) => {
      if (!object(fixture)) return errors.push(`fixtures[${index}] must be an object`);
      if (!syntheticRef(fixture.fixture_ref, "segment")) errors.push(`fixtures[${index}].fixture_ref must be synthetic`);
      if (refs.has(fixture.fixture_ref)) errors.push(`fixtures[${index}].fixture_ref must be unique`);
      refs.add(fixture.fixture_ref);
      if (!["accepted", "rejected"].includes(fixture.expected_decision)) errors.push(`fixtures[${index}].expected_decision is invalid`);
      decisions.add(fixture.expected_decision);
    });
    for (const decision of ["accepted", "rejected"]) if (!decisions.has(decision)) errors.push(`fixtures must include an ${decision} decision`);
  }

  if (typeof config.evidence_ref !== "string" || !config.evidence_ref.startsWith("docs/")) errors.push("evidence_ref must reference committed documentation");
  rejectSensitiveKeys(config, "config", errors);
  return errors;
}

function validateVideoInput(video, config) {
  const codes = [];
  if (!object(video) || !syntheticRef(video.video_ref, "video") || !["eligible", "shadow-only", "rejected"].includes(video.capture_decision)) return ["invalid-input"];
  if (video.capture_decision === "rejected") codes.push("capture-not-eligible");
  if (!object(video.metadata) || video.metadata.source_timestamps !== true || video.metadata.variable_frame_rate !== true || video.metadata.original_aspect_ratio !== true || video.metadata.source_resolution !== true) codes.push("metadata-not-preserved");

  const timestamps = video.timestamps_ms;
  if (!Array.isArray(timestamps) || timestamps.length < 2 || timestamps.some((value) => !finite(value) || value < 0)) codes.push("invalid-input");
  else if (timestamps.some((value, index) => index > 0 && value <= timestamps[index - 1])) codes.push("timestamps-not-monotonic");

  if (!object(video.groups) || GROUP_KEYS.some((key) => !syntheticRef(video.groups[key], key.replace(/_ref$/, "").replaceAll("_", "-")))) codes.push("invalid-input");
  if (!Array.isArray(video.candidate_windows) || video.candidate_windows.length === 0) codes.push("invalid-input");
  else if (Array.isArray(timestamps) && timestamps.length >= 2 && timestamps.every(finite)) {
    const ordered = [...video.candidate_windows].sort((a, b) => (a.start_timestamp_ms ?? Infinity) - (b.start_timestamp_ms ?? Infinity));
    ordered.forEach((window) => {
      if (!object(window) || !syntheticRef(window.window_ref, "window") || !syntheticRef(window.fence_ref, "fence")) return codes.push("invalid-input");
      const values = [window.start_timestamp_ms, window.takeoff_timestamp_ms, window.landing_timestamp_ms, window.end_timestamp_ms];
      if (values.some((value) => !finite(value))) return codes.push("invalid-input");
      if (!(values[0] < values[1] && values[1] < values[2] && values[2] < values[3])) codes.push("window-order-invalid");
      if (values[0] < timestamps[0] || values[3] > timestamps.at(-1)) codes.push("window-out-of-bounds");
      if (!Number.isInteger(window.strides_before) || !Number.isInteger(window.strides_after) || window.strides_before < config.context.minimum_strides_before || window.strides_after < config.context.minimum_strides_after) codes.push("insufficient-context");
    });
    for (let index = 1; index < ordered.length; index += 1) {
      if (finite(ordered[index - 1]?.end_timestamp_ms) && finite(ordered[index]?.start_timestamp_ms) && ordered[index].start_timestamp_ms < ordered[index - 1].end_timestamp_ms) codes.push("overlapping-windows");
    }
  }
  return [...new Set(codes)];
}

export function evaluateVideoSegmentation(video, config) {
  if (validateBatch8Config(config).length) return { decision: "rejected", rejection_codes: ["invalid-input"], windows: [], lineage_ref: null };
  const rejection_codes = validateVideoInput(video, config);
  if (rejection_codes.length) return { decision: "rejected", rejection_codes, windows: [], lineage_ref: null };
  const windows = video.candidate_windows.map((window) => ({
    ...window,
    lineage_ref: `lineage-${stableHash(
      canonicalJson({
        video_ref: video.video_ref,
        capture_decision: video.capture_decision,
        metadata: video.metadata,
        timestamps_ms: video.timestamps_ms,
        groups: video.groups,
        window,
      }),
    ).slice(0, 24)}`,
  }));
  return {
    decision: "accepted",
    rejection_codes: [],
    windows,
    lineage_ref: `lineage-${stableHash(
      canonicalJson({
        video_ref: video.video_ref,
        capture_decision: video.capture_decision,
        metadata: video.metadata,
        timestamps_ms: video.timestamps_ms,
        groups: video.groups,
        windows,
      }),
    ).slice(0, 24)}`,
  };
}

export function planDatasetSplits(videos, config) {
  if (validateBatch8Config(config).length || !Array.isArray(videos) || videos.length === 0) return { decision: "rejected", rejection_codes: ["invalid-input"], assignments: [] };
  if (new Set(videos.map((video) => video?.video_ref)).size !== videos.length) {
    return { decision: "rejected", rejection_codes: ["dataset-leakage"], assignments: [] };
  }
  const evaluations = videos.map((video) => evaluateVideoSegmentation(video, config));
  if (evaluations.some((result) => result.decision === "rejected")) return { decision: "rejected", rejection_codes: [...new Set(evaluations.flatMap((result) => result.rejection_codes))], assignments: [] };

  const parent = videos.map((_, index) => index);
  const find = (index) => parent[index] === index ? index : (parent[index] = find(parent[index]));
  const union = (left, right) => { const a = find(left); const b = find(right); if (a !== b) parent[b] = a; };
  for (const key of GROUP_KEYS) {
    const seen = new Map();
    videos.forEach((video, index) => {
      const value = video.groups[key];
      if (seen.has(value)) union(index, seen.get(value));
      else seen.set(value, index);
    });
  }

  const components = new Map();
  videos.forEach((video, index) => {
    const root = find(index);
    if (!components.has(root)) components.set(root, []);
    components.get(root).push(index);
  });
  const assignments = [];
  for (const indexes of components.values()) {
    const componentKey = [...new Set(indexes.flatMap((index) => GROUP_KEYS.map((key) => `${key}:${videos[index].groups[key]}`)))].sort().join("|");
    const split = chooseSplit(componentKey, config.split_ratios);
    indexes.forEach((index) => assignments.push({ video_ref: videos[index].video_ref, split, lineage_ref: evaluations[index].lineage_ref }));
  }
  assignments.sort((a, b) => a.video_ref.localeCompare(b.video_ref));
  return { decision: "accepted", rejection_codes: [], assignments };
}

export const batch8Constants = { GROUP_KEYS, REQUIRED_REJECTION_CODES, SPLITS };
