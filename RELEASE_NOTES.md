## Echo360 Static Global Style Fix v0.3.0

避免 Echo360 在界面更新时重复删除、解析和插入静态全局样式。已在一个 Windows / Chrome 156 环境验证：主要 CSS 解析热点几乎消失。详细数据及限制见 README。

Avoids rebuilding the tested Echo360 application static global stylesheet on repeated renders. The main CSS-parsing hotspot nearly disappeared in one observed Windows / Chrome 156 environment; results are not a cross-device guarantee.

### Install

Install Tampermonkey, then open `echo360-static-global-style-fix.user.js` from the release assets. Disable older Echo360 Progress CSS Fix scripts and reload the lesson page.

Supported URL: `https://echo360.org.uk/lesson/*`.

Run `Echo360GlobalStyleFix.status()` to verify both patch counters are `1`. See README for compatibility, rollback, and observed profiling results.
