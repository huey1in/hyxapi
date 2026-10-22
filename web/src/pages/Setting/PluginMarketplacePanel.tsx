import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Plus, Store, Trash2 } from 'lucide-react';
import { z } from 'zod';
import { Button, EmptyState, Input, Modal, Select, Table, showSuccess } from '../../components/ui';
import { useOwnedOperation } from '../../hooks/useOwnedOperation';
import { apiErrorMessage } from '../../lib/api-error';
import {
  fetchMarketplaceArtifact,
  loadMarketplaceIndex,
  MarketplaceHTTPError,
} from './taskPluginMarketplace.js';
import {
  pluginBase,
  pluginSourcesSchema,
  validPluginSources,
} from './task-plugin-data';
import type { PluginDraft, PluginSource } from './task-plugin-data';
import { pluginRequest } from './task-plugin-query';
import { PluginField } from './TaskPluginEditor';

const artifactSchema = z.object({
  path: z.string().min(1),
  sha256: z.string().optional(),
});
const catalogSchema = z.array(
  z.object({
    key: z.string().min(1),
    name: z.string(),
    description: z.string(),
    latest: z.string().min(1),
    versions: z
      .array(
        artifactSchema.extend({
          version: z.string().min(1),
          minApiVersion: z.coerce.number().int().positive().default(1),
        }),
      )
      .min(1),
    iconFile: artifactSchema.optional(),
  }),
);
type MarketPlugin = z.infer<typeof catalogSchema>[number];
export default function TaskPluginMarketplace({
  identity,
  sources,
  onImport,
  onSaved,
}: {
  identity: string;
  sources: PluginSource[];
  onImport: (draft: PluginDraft) => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { busy, run } = useOwnedOperation();
  const [selected, setSelected] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [versions, setVersions] = useState<Record<string, string>>({});
  const [editingSources, setEditingSources] = useState(false);
  const source =
    sources.find((item) => item.index_url === selected)?.index_url ??
    sources[0]?.index_url ??
    '';
  const query = useQuery({
    queryKey: ['task-plugin-market', identity, source, generation],
    enabled: Boolean(source && loaded),
    gcTime: 0,
    retry: false,
    queryFn: async ({ signal }) => {
      const result: unknown = await loadMarketplaceIndex(
        source,
        undefined,
        signal,
      );
      signal.throwIfAborted();
      const parsed = catalogSchema.safeParse(result);
      if (!parsed.success) throw new Error('Invalid plugin marketplace data');
      return parsed.data;
    },
  });
  const load = () => {
    setLoaded(true);
    setGeneration((value) => value + 1);
    setVersions({});
  };
  const errorMessage = (error: unknown) =>
    error instanceof MarketplaceHTTPError
      ? t('Plugin download failed (HTTP {{status}})', { status: error.status })
      : t(apiErrorMessage(error, 'Unable to load plugin marketplace'));
  const downloadFile = async (
    path: string,
    sha256: string | undefined,
    decodeText: boolean,
    signal: AbortSignal,
  ) => {
    try {
      return await fetchMarketplaceArtifact(
        source,
        path,
        sha256,
        undefined,
        decodeText,
        signal,
      );
    } catch (error) {
      if (error instanceof MarketplaceHTTPError)
        throw new Error(errorMessage(error));
      throw error;
    }
  };
  const download = (plugin: MarketPlugin) =>
    void run(async (signal) => {
      const version = plugin.versions.find(
        (item) => item.version === (versions[plugin.key] || plugin.latest),
      );
      if (!version || version.minApiVersion > 1)
        throw new Error('This plugin requires a newer plugin API version');
      const file = await downloadFile(
        version.path,
        version.sha256,
        true,
        signal,
      );
      let icon = '';
      if (plugin.iconFile) {
        const artifact = await downloadFile(
          plugin.iconFile.path,
          plugin.iconFile.sha256,
          false,
          signal,
        );
        if (artifact.bytes.length > 256 * 1024)
          throw new Error('Choose an SVG or PNG icon up to 256 KiB');
        const binary = Array.from(artifact.bytes, (byte) =>
          String.fromCharCode(byte),
        ).join('');
        icon = `data:image/${/\.png$/i.test(plugin.iconFile.path) ? 'png' : 'svg+xml'};base64,${btoa(binary)}`;
      }
      signal.throwIfAborted();
      onImport({
        source: file.source!,
        sourceSha256: file.sha256,
        enabled: true,
        remark: `${plugin.key} ${version.version}`,
        icon,
        marketName: `${plugin.name} ${version.version}`,
      });
    });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <Select
            aria-label={t('Plugin marketplace source')}
            width="full"
            value={source}
            options={sources.map((item) => ({
              value: item.index_url,
              label: item.name,
            }))}
            disabled={busy}
            onChange={(value) => {
              setSelected(value);
              setLoaded(false);
              setVersions({});
            }}
          />
        </div>
        <Button
          variant="toggle"
          loading={query.isFetching}
          disabled={busy || !source}
          onClick={load}
        >
          {t('Load marketplace')}
        </Button>
        <Button
          variant="link"
          disabled={busy}
          onClick={() => setEditingSources(true)}
        >
          {t('Manage sources')}
        </Button>
      </div>
      {query.isError ? (
        <div role="alert" className="space-y-2 text-sm text-ui-danger">
          <p>{errorMessage(query.error)}</p>
          <Button onClick={load}>{t('Retry')}</Button>
        </div>
      ) : !loaded ? (
        <EmptyState icon={Store} padding='sm' title={t('Select a marketplace source, then load available plugins.')} />
      ) : (
        <Table
          emptyIcon={Store}
          loading={query.isPending}
          rows={query.data ?? []}
          rowKey="key"
          minWidth={560}
          emptyText={t('No compatible task plugins from this source')}
          columns={[
            {
              key: 'name',
              title: t('Plugin'),
              render: (plugin) => (
                <div>
                  {plugin.name}
                  <div className="whitespace-pre-wrap text-xs text-ui-text-3">
                    {plugin.description}
                  </div>
                </div>
              ),
            },
            {
              key: 'version',
              title: t('Version'),
              render: (plugin) => (
                <Select
                  aria-label={t('Marketplace version · {{key}}', {
                    key: plugin.key,
                  })}
                  value={versions[plugin.key] || plugin.latest}
                  disabled={busy}
                  options={plugin.versions.map((item) => ({
                    value: item.version,
                    label: item.version,
                  }))}
                  onChange={(value) =>
                    setVersions((current) => ({
                      ...current,
                      [plugin.key]: value,
                    }))
                  }
                />
              ),
            },
            {
              key: 'install',
              title: t('Install'),
              render: (plugin) => (
                <Button
                  size="sm"
                  variant="toggle"
                  loading={busy}
                  onClick={() => download(plugin)}
                >
                  {t('Download and preview')}
                </Button>
              ),
            },
          ]}
        />
      )}
      {editingSources && (
        <SourcesEditor
          sources={sources}
          onClose={() => setEditingSources(false)}
          onSaved={() => {
            setLoaded(false);
            onSaved();
          }}
        />
      )}
    </div>
  );
}
function SourcesEditor({
  sources,
  onClose,
  onSaved,
}: {
  sources: PluginSource[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const { busy, run } = useOwnedOperation();
  const [draft, setDraft] = useState(() =>
    sources.map((item) => ({ ...item })),
  );
  return (
    <Modal
      open
      width={560}
      title={t('Plugin marketplace sources')}
      onClose={onClose}
      confirmText={t('Save')}
      cancelText={t('Cancel')}
      loading={busy}
      footer={
        <>
          <Button onClick={onClose}>{t('Cancel')}</Button>
          <Button
            loading={busy}
            disabled={!validPluginSources(draft)}
            onClick={() =>
              void run(async (signal) => {
                if (!validPluginSources(draft)) return;
                await pluginRequest(
                  'put',
                  `${pluginBase}/marketplace/sources`,
                  pluginSourcesSchema,
                  signal,
                  draft.map((item) => ({
                    name: item.name.trim(),
                    index_url: item.index_url.trim(),
                  })),
                );
                showSuccess(t('Marketplace sources saved'));
                onSaved();
                onClose();
              })
            }
          >
            {t('Save')}
          </Button>
        </>
      }
    >
      <fieldset disabled={busy} className="space-y-4">
        {draft.map((item, index) => (
          <div key={index} className="space-y-2 border-b border-ui-border pb-3">
            <PluginField label={t('Source name')}>
              <Input
                value={item.name}
                onChange={(name) =>
                  setDraft((current) =>
                    current.map((row, i) =>
                      i === index ? { ...row, name } : row,
                    ),
                  )
                }
              />
            </PluginField>
            <PluginField label={t('Index URL')}>
              <Input
                value={item.index_url}
                onChange={(index_url) =>
                  setDraft((current) =>
                    current.map((row, i) =>
                      i === index ? { ...row, index_url } : row,
                    ),
                  )
                }
              />
            </PluginField>
            <Button
              size="sm"
              variant="link"
              icon={Trash2}
              onClick={() =>
                setDraft((current) => current.filter((_, i) => i !== index))
              }
            >
              {t('Remove source')}
            </Button>
          </div>
        ))}
        <Button
          size="sm"
          variant="toggle"
          icon={Plus}
          onClick={() =>
            setDraft((current) => [...current, { name: '', index_url: '' }])
          }
        >
          {t('Add source')}
        </Button>
      </fieldset>
      {!validPluginSources(draft) && (
        <p role="alert" className="text-xs text-ui-danger">
          {t(
            'Give each source a name and an HTTP or HTTPS URL without credentials.',
          )}
        </p>
      )}
    </Modal>
  );
}
