// Active background: cobweb lattice with cursor glow and click impulses.
//
// Rendered only on the sign-in, sign-up and recovery screens and on the 404 and
// error pages: it is a full-screen canvas redrawn every frame, and on content
// pages it cost main-thread time on every page and every click.
export { default } from "./interactive-background-web";
