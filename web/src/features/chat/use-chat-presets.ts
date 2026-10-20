import { useContext, useMemo } from 'react';
import { StatusContext } from '../../context/Status';
import { parseChatConfig } from './chat-links';

export function useChatPresets() {
  const [state] = useContext(StatusContext);
  const presets = useMemo(() => parseChatConfig(state.status?.chats), [state.status?.chats]);
  const configured = state.status?.server_address;
  let address = window.location.origin;
  if (typeof configured === 'string') { try { const url = new URL(configured); if (['http:', 'https:'].includes(url.protocol) && !url.username && !url.password) address = configured.replace(/\/+$/, ''); } catch {} }
  return { presets, address, ready: Boolean(state.status) };
}
