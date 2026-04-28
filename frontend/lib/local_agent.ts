let ws: WebSocket | null = null;
let messageHandlers: Map<string, (data: any) => void> = new Map();
let reqId = 0;

export function connectLocalAgent(): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      resolve(ws);
      return;
    }

    ws = new WebSocket("ws://127.0.0.1:8765");

    ws.onopen = () => {
      resolve(ws!);
    };

    ws.onerror = (err) => {
      reject(err);
    };

    ws.onclose = () => {
      ws = null;
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const handler = messageHandlers.get(data.request_id);
        if (handler) {
          handler(data);
          messageHandlers.delete(data.request_id);
        }
      } catch {}
    };
  });
}

export function disconnectLocalAgent() {
  if (ws) {
    ws.close();
    ws = null;
  }
}

export function isConnected(): boolean {
  return ws !== null && ws.readyState === WebSocket.OPEN;
}

export async function sendAction(action: string, params?: any): Promise<any> {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    await connectLocalAgent();
  }
  const id = `${++reqId}`;
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      messageHandlers.delete(id);
      reject(new Error("Local Agent request timeout"));
    }, 30000);

    messageHandlers.set(id, (data) => {
      clearTimeout(timeout);
      if (data.error) {
        reject(new Error(data.error));
      } else {
        resolve(data.data);
      }
    });

    ws!.send(JSON.stringify({ request_id: id, action, params }));
  });
}
