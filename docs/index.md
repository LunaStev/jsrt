---
title: Home
nav_order: 1
description: Documentation for jsrt, an experimental JavaScript runtime written in Wave and powered by JavaScriptCore.
---

<section class="jsrt-hero">
  <p class="jsrt-hero__eyebrow">Experimental runtime</p>
  <h1 class="jsrt-hero__title">jsrt</h1>
  <p class="jsrt-hero__lead">
    A JavaScript runtime written in Wave and powered by JavaScriptCore, with
    CommonJS and ES modules, selected Node.js and Web APIs, and a package installer.
  </p>
  <div class="jsrt-hero__actions">
    <a href="{{ '/getting-started/' | relative_url }}" class="btn btn-primary">Get started</a>
    <a href="{{ '/compatibility/' | relative_url }}" class="btn">Check compatibility</a>
    <a href="https://github.com/potatosl/jsrt" class="btn">GitHub</a>
  </div>
  <div class="jsrt-terminal" aria-label="Example terminal session">
    <div class="jsrt-terminal__bar" aria-hidden="true"><span></span><span></span><span></span></div>
<pre><span class="dim"># hello.js</span>
<span class="prompt">$</span> jsrt hello.js
<span class="out">Hello from jsrt</span>
<span class="prompt">$</span> jsrt -e "console.log(1 + 1)"
<span class="out">2</span></pre>
  </div>
</section>

## Start here

<div class="jsrt-cards">
  <a class="jsrt-card" href="{{ '/getting-started/' | relative_url }}">
    <span class="jsrt-card__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 17 6-6-6-6M12 19h8"/></svg></span>
    <span class="jsrt-card__title">Getting started</span>
    <span class="jsrt-card__text">Run scripts and use the CLI.</span>
  </a>
  <a class="jsrt-card" href="{{ '/distribution/' | relative_url }}">
    <span class="jsrt-card__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg></span>
    <span class="jsrt-card__title">Installation</span>
    <span class="jsrt-card__text">Verify and install a Linux release bundle.</span>
  </a>
  <a class="jsrt-card" href="{{ '/packages/' | relative_url }}">
    <span class="jsrt-card__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m7.5 4.3 9 5.2M21 8v8a2 2 0 0 1-1 1.7l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.7l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8zM3.3 7 12 12l8.7-5M12 22V12"/></svg></span>
    <span class="jsrt-card__title">Packages</span>
    <span class="jsrt-card__text">Install dependencies and manage a project lockfile.</span>
  </a>
  <a class="jsrt-card" href="{{ '/compatibility/' | relative_url }}">
    <span class="jsrt-card__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></span>
    <span class="jsrt-card__title">Compatibility</span>
    <span class="jsrt-card__text">Check supported APIs and behavior differences.</span>
  </a>
  <a class="jsrt-card" href="{{ '/security/' | relative_url }}">
    <span class="jsrt-card__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>
    <span class="jsrt-card__title">Security</span>
    <span class="jsrt-card__text">Understand execution permissions and resource limits.</span>
  </a>
  <a class="jsrt-card" href="{{ '/architecture/' | relative_url }}">
    <span class="jsrt-card__icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><path d="M10 6.5h4M17.5 10v4M6.5 10v7.5H14"/></svg></span>
    <span class="jsrt-card__title">Architecture</span>
    <span class="jsrt-card__text">How the Wave host and JavaScriptCore fit together.</span>
  </a>
</div>

<div class="jsrt-notice" markdown="1">
**Under active development.** Applications need to be checked against the
supported API subset. Scripts, Workers, and native add-ons run with the host
process's permissions.
</div>

## Contribute

See the [contributor guide](https://github.com/potatosl/jsrt/blob/main/CONTRIBUTING.md)
for source checks, build requirements, and pull requests. The
[architecture](architecture.md) and [engine reference](engine-source.md) describe
how the host and JavaScriptCore fit together.
