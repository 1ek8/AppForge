import { useState, useEffect } from 'react';
import { WebContainer } from '@webcontainer/api';
import { getWebContainer } from '../lib/webcontainer';

export function useWebContainer() {
  const [instance, setInstance] = useState<WebContainer | null>(null);
  const [isBooting, setIsBooting] = useState(true);
  const [serverUrl, setServerUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const container = await getWebContainer();
        if (mounted) {
          setInstance(container);
          setIsBooting(false);
          
          container.on('server-ready', (port, url) => {
            setServerUrl(url);
          });
        }
      } catch (error) {
        console.error('Failed to boot WebContainer:', error);
        if (mounted) setIsBooting(false);
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  return { instance, isBooting, serverUrl };
}