interface SnapPayCallbacks {
  onSuccess?: (result: any) => void;
  onPending?: (result: any) => void;
  onError?: (result: any) => void;
  onClose?: () => void;
}

interface Window {
  snap?: {
    pay: (token: string, callbacks?: SnapPayCallbacks) => void;
    embed: (token: string, options: { embedId: string }) => void;
    hide: () => void;
    show: () => void;
  };
}
