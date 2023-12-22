import { TransactionIllustration } from './TransactionIllustration.tsx';
import { BaseSyntheticEvent, useCallback, useState } from 'react';

function App() {
  const [rpc, setRpc] = useState('https://mainnet.ckb.dev');
  const [isMainnet, setIsMainnet] = useState(true);
  const [txHash, setTxHash] = useState('0x9a3b69068f687320701a690f58bc93d608f30fd72f035137e509a0cce7a8fc39');

  const onChange = useCallback((e: BaseSyntheticEvent) => {
    e.preventDefault();
    const [rpcInput, mainnetInput, txHashInput]: [HTMLInputElement, HTMLInputElement, HTMLInputElement] = e.target;

    setRpc(rpcInput.value);
    setIsMainnet(mainnetInput.checked);
    setTxHash(txHashInput.value);
  }, []);

  return (
    <div>
      <form onSubmit={onChange}>
        <label htmlFor="rpc">RPC</label>
        <input id="rpc" defaultValue={rpc} />

        <br />

        <label htmlFor="isMainnet">Mainnet</label>
        <input id="isMainnet" type="checkbox" defaultChecked={isMainnet} />

        <br />

        <label htmlFor="txHash">TxHash</label>
        <input id="txHash" defaultValue={txHash} />

        <br />

        <button type="submit">OK</button>
      </form>
      <TransactionIllustration hash={txHash} isMainnet={isMainnet} url={rpc} />
    </div>
  );
}

export default App;
