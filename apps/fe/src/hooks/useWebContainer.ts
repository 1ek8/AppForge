import { useState, useEffect, useRef, useCallback } from 'react';
import { WebContainer } from '@webcontainer/api';
import { fileListToWebContainerFS, getWebContainer } from '../lib/webcontainer';
import { WriteStream } from 'fs';

export type WebContainerStatus =
  | 'idle'
  | 'booting'
  | 'mounting'
  | 'installing'
  | 'starting'
  | 'ready'
  | 'error';

export interface UseWebContainerReturn {
  instance: WebContainer | null;
  serverUrl: string | null;
  status: WebContainerStatus;
  mountFiles: (files: Array<{ filePath: string; content: string }>) => Promise<void>;
  startDevServer: () => Promise<void>;
  writeFile: (filePath: string, content: string) => Promise<void>;
}

export function useWebContainer(): UseWebContainerReturn {
  const [instance, setInstance] = useState<WebContainer | null>(null);
  const [status, setStatus] = useState<WebContainerStatus>('idle');
  const [serverUrl, setServerUrl] = useState<string | null>(null);
  const serverReadyRegistered = useRef(false);

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
      if(mounted) setStatus('error');
    });

    return () => {
      mounted = false;
    };
  }, []);

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
      if(installCode !== 0){
        console.error('Webcontainers npm install exited with non-zero code: ', installCode);
        setStatus('error');
        return;
      }
      console.log('npm install executed');

      setStatus('starting');
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
        });
      }
    } catch(err) {
      console.error('Webcontainer startDevserver error: ', err);
      setStatus('error');
    }
  }, [instance]);

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

  return { instance, serverUrl, status, mountFiles, startDevServer, writeFile };
}