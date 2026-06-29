import { TEMPLATE_KIND_LABEL } from '@/lib/constants';
import { extractVars } from '@/lib/templates';
import type { MessageTemplateRow } from '@/types/database';
import { NewTemplateButton, EditTemplateButton } from './template-dialog';
import { DeleteTemplateButton } from './template-actions';

// Reusable outreach boilerplate manager. Server-rendered list; the New/Edit/Delete
// controls are client islands. Templates are used from the outreach composer on
// /contacts (pick → fill {variables} → optional AI personalize → Log outreach).
export function TemplatesPanel({ templates }: { templates: MessageTemplateRow[] }) {
  return (
    <div className="space-y-3 border border-system/20 bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-fg">Message templates</h2>
          <p className="mt-0.5 text-xs text-muted">
            Reusable outreach with <span className="font-mono text-faint">{'{variable}'}</span>{' '}
            slots — fill and optionally AI-personalize them from the contacts page.
          </p>
        </div>
        <NewTemplateButton />
      </div>

      {templates.length === 0 ? (
        <p className="text-xs text-faint">
          No templates yet — add a detachering DM, open-application email, or follow-up to reuse.
        </p>
      ) : (
        <ul className="divide-y divide-border/60">
          {templates.map((t) => {
            const vars = extractVars(`${t.subject ?? ''} ${t.body}`);
            return (
              <li key={t.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm text-fg" title={t.name}>
                      {t.name}
                    </span>
                    <span className="shrink-0 border border-border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
                      {TEMPLATE_KIND_LABEL[t.kind]}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 font-mono text-[11px] text-faint">{t.body}</p>
                  {vars.length > 0 ? (
                    <p className="mt-1 font-mono text-[10px] text-faint">
                      uses {vars.map((v) => `{${v}}`).join(' ')}
                    </p>
                  ) : null}
                </div>
                <span className="flex shrink-0 items-center">
                  <EditTemplateButton row={t} />
                  <DeleteTemplateButton id={t.id} />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
