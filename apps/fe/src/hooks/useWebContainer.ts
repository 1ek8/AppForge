import { useState, useEffect, useRef, useCallback } from 'react';
import { WebContainer } from '@webcontainer/api';
import { fileListToWebContainerFS, getWebContainer, resetWebContainer } from '../lib/webcontainer';

export type WebContainerStatus =
  | 'idle'
  | 'booting'
  | 'mounting'
  | 'installing'
  | 'starting'
  | 'ready'
  | 'error';

export interface WebContainerEvent {
  id: number;
  label: string;
  status: 'running' | 'done' | 'error';
  error?: string;
}

export interface UseWebContainerReturn {
  instance: WebContainer | null;
  serverUrl: string | null;
  status: WebContainerStatus;
  events: WebContainerEvent[];
  mountFiles: (files: Array<{ filePath: string; content: string }>) => Promise<void>;
  startDevServer: () => Promise<void>;
  writeFile: (filePath: string, content: string) => Promise<void>;
  reset: () => Promise<void>;
}

export function useWebContainer(): UseWebContainerReturn {
  const [instance, setInstance] = useState<WebContainer | null>(null);
  const [status, setStatus] = useState<WebContainerStatus>('idle');
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const [events, setEvents] = useState<WebContainerEvent[]>([]);
  const serverReadyRegistered = useRef(false);
  const eventIdRef = useRef(0);

  const pushEvent = useCallback((label: string, eventStatus: WebContainerEvent['status'], error?: string) => {
    const id = ++eventIdRef.current;
    setEvents((prev) => [...prev, { id, label, status: eventStatus, error }]);
  }, []);

  useEffect(() => {
    setStatus('booting');
    let mounted = true;

    getWebContainer().then(container => {
      if(!mounted) return;
      setInstance(container);
      setStatus('idle');
      console.log('Webcontainer booted successfully')
    }).catch(err => {
      console.error('Webcontainer couldnt be booted correctly');
      if(mounted) {
        setStatus('error');
        pushEvent('Booting WebContainer', 'error', 'WebContainer failed to boot. Check the browser console for details.');
      }
    });

    return () => {
      mounted = false;
    };
  }, [pushEvent]);

  const mountFiles = useCallback(
    async (files: Array<{ filePath: string, content: string }>) => {
      if(!instance){
        console.warn('Webcontainer mountFiles called but instance isnt set yet');
        return;
      }
      setStatus('mounting');
      const fsTree = fileListToWebContainerFS(files);
      await instance.mount(fsTree);
      console.log('Webcontainer files mounted');
      setStatus('idle');
    },
    [instance]
  );

  const startDevServer = useCallback( async () => {
    if(!instance){
      console.warn('Webcontainer startDevServer called but instance hasnt been set yet');
      return;
    }

    try{
      setStatus('installing');
      pushEvent('npm install', 'running');
      console.log('Before running npm install');
      const installProc = await instance.spawn('npm', ['install']);

      installProc.output.pipeTo(
        new WritableStream({
          write(data) {
            console.log('[npm install', data);
          }
        })
      );

      const installCode = await installProc.exit;
      pushEvent('npm install', 'done');
      if(installCode !== 0){
        console.error('Webcontainers npm install exited with non-zero code: ', installCode);
        setStatus('error');
        pushEvent('npm install', 'error', `npm install exited with code ${installCode}`);
        return;
      }
      console.log('npm install executed');

      setStatus('starting');
      pushEvent('npm run dev', 'running');
      console.log('Starting dev server');
      const devProc = await instance.spawn('npm', ['run', 'dev']);

      devProc.output.pipeTo(
        new WritableStream({
          write(data) {
            console.log('npm run dev:', data);
          }
        })
      );

      if(!serverReadyRegistered.current){
        serverReadyRegistered.current = true;

        instance.on('server-ready', (_port, url) => {
          console.log('Webcontianer server ready at url: ', url);
          setServerUrl(url);
          setStatus('ready');
          pushEvent('npm run dev', 'done');
        });
      }
    } catch(err) {
      console.error('Webcontainer startDevserver error: ', err);
      setStatus('error');
      pushEvent('npm run dev', 'error', 'Failed to start the dev server');
    }
  }, [instance, pushEvent]);

  const writeFile = useCallback(
    async (filePath: string, content: string) => {
      if(!instance){
        console.warn('Webcontainer tried to write a file but instance hasnt been set yet');
        return;
      }
      try {
        const parts = filePath.split('/');
        if(parts.length > 1){
          const dir = parts.slice(0, -1).join('/');
          await instance.fs.mkdir(dir, { recursive: true}).catch(() => {});
        }
        await instance.fs.writeFile(filePath, content);
      } catch (error) {
        console.error(`Webcontainer writeFile failed for ${filePath}: `, error);
      }
    },
    [instance]
  );

  const reset = useCallback(async () => {
    await resetWebContainer();
    setInstance(null);
    setServerUrl(null);
    setEvents([]);
    setStatus('booting');
    eventIdRef.current = 0;
    serverReadyRegistered.current = false;

    try {
      const container = await getWebContainer();
      setInstance(container);
      setStatus('idle');
    } catch (err) {
      console.error('Webcontainer re-boot failed:', err);
      setStatus('error');
      pushEvent('Booting WebContainer', 'error', 'WebContainer failed to reboot. Try reloading the page.');
    }
  }, [pushEvent]);

  return { instance, serverUrl, status, events, mountFiles, startDevServer, writeFile, reset };
}