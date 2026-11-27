// Copyright (c) 2026 Kamil Wilczyński (kwilcz). Licensed under the Apache License, Version 2.0: see LICENSE.
// The entry skills beside graphally (infographic, bpmn, diagram …): each is valid in every client that
// reads Agent Skills, and routes to graphally. Its frontmatter holds only a name, the folder's own, and
// a description that a YAML reader takes as plain text; its body loads graphally, names references
// and scripts that graphally has, and says how to install graphally when it is missing.
import fs from 'node:fs';
import path from 'node:path';
import { check, root, skillDir } from './helpers.mjs';

const SKILLS = path.join(root, 'skills');
const NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const INSTALL = 'https://github.com/kwilcz/graphally#install-for-your-agent';

// The frontmatter's keys and values, read line by line (a plain scalar on one line each), and the body.
function readSkill(file) {
  const text = fs.readFileSync(file, 'utf8');
  const [, frontmatter = '', body = ''] = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text) || [];
  const fields = Object.fromEntries(frontmatter.split('\n')
    .map(line => /^([a-z-]+): (.*)$/.exec(line)?.slice(1) || [line, '']));
  return { fields, body };
}

function checkFrontmatter(name, fields) {
  const keys = Object.keys(fields).join();
  check(keys === 'name,description', `${name}: the frontmatter holds ${keys}, not only name and description`);
  check(fields.name === name && NAME.test(name) && name.length <= 64, `${name}: its name is not its folder's`);
  const description = fields.description || '';
  check(description.length > 0 && description.length <= 1024, `${name}: the description is ${description.length} long`);
  check(!/: |^["'[{>|&*!%@`]| #/.test(description), `${name}: the description is not plain YAML text`);
  check(/graphally/.test(description), `${name}: the description does not name graphally`);
}

// Every reference and script the body names is graphally's.
function checkBody(name, body) {
  check(body.includes('../graphally/SKILL.md') && /Load the graphally skill/.test(body),
    `${name}: it does not load graphally`);
  check(body.includes(INSTALL), `${name}: it does not say how to install graphally`);
  for (const [named] of body.matchAll(/(?:references|scripts)\/[\w.-]+\.(?:md|mjs)/g)) {
    check(fs.existsSync(path.join(skillDir, named)), `${name}: graphally has no ${named}`);
  }
}

export function entrySkills() {
  const names = fs.readdirSync(SKILLS)
    .filter(name => name !== 'graphally' && fs.existsSync(path.join(SKILLS, name, 'SKILL.md')));
  check(names.includes('diagram') && names.length >= 2, `the entry skills are missing: ${names.join(', ')}`);
  for (const name of names) {
    const { fields, body } = readSkill(path.join(SKILLS, name, 'SKILL.md'));
    checkFrontmatter(name, fields);
    checkBody(name, body);
  }
  const own = readSkill(path.join(skillDir, 'SKILL.md')).fields.description || '';
  check(own.length <= 1024, `graphally's description is ${own.length} long`);
}
