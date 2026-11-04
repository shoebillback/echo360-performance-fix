# Changelog

## v0.3.0

- Reuse the tested application static global stylesheet instead of repeatedly removing, parsing and reinserting it.
- Validate module 867 using known source markers and require a static global-style export.
- Preserve rebuilding after stylesheet removal, unmounting, or stylesheet changes.
- Provide status counters, enable/disable controls and timed render-count comparisons.
- Add bilingual documentation and loader/lifecycle regression tests.

This replaces the earlier progress-quantization experiment. Progress precision is unchanged.
