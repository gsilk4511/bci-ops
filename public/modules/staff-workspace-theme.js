import {esc} from '../app.js';
import {findProfileStyleOption,normalizeProfileStyle} from './profile-style-catalog.js';

export function staffWorkspaceTheme(style,content){
 const saved=normalizeProfileStyle(style);
 const section=findProfileStyleOption('section',saved.section);
 const text=findProfileStyleOption('text',saved.text);
 const lighting=findProfileStyleOption('lighting',saved.lighting);
 const banner=findProfileStyleOption('banner',saved.banner);
 const properties=[
  ['--staff-workspace-surface',section.background],
  ['--staff-workspace-border',section.border],
  ['--staff-workspace-text',text.color],
  ['--staff-workspace-muted',text.muted],
  ['--staff-workspace-glow',lighting.glow],
  ['--staff-workspace-banner',banner.background]
 ].map(([key,value])=>key+':'+value).join(';');
 return `<div class="bci-staff-workspace" style="${esc(properties)}">${content}</div>`;
}
