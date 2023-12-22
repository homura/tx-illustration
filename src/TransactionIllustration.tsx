import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BI, helpers, RPC, Script } from '@ckb-lumos/lumos';
import * as d3 from 'd3';
import { HierarchyPointNode } from 'd3';

type Node = TransactionNode | CellNode;

type TransactionNode = {
  kind: 'tx';
  txHash: string;

  children?: CellNode[];
};

type CellNode = {
  kind: 'cell';

  capacity: string;
  lock: Script;
  type?: Script;
  data: string;

  children?: TransactionNode[];
};

type TxIo = [TransactionNode /*input*/, TransactionNode /*output*/];

async function getTxIo({ url, txHash }: { txHash: string; url: string; isMainnet?: boolean }): Promise<TxIo> {
  const rpc = new RPC(url);
  const tx = await rpc.getTransaction(txHash);

  const outputs = tx.transaction.outputs.map<CellNode>((output, index) => ({
    ...output,
    kind: 'cell',
    data: tx.transaction.outputsData[index] || '0x',
  }));

  const inputsPromise = tx.transaction.inputs.map<Promise<CellNode>>(async (input) => {
    const previousTx = await rpc.getTransaction(input.previousOutput.txHash);

    const index = Number(input.previousOutput.index);
    const output = previousTx.transaction.outputs[index];
    const data = previousTx.transaction.outputsData[index] || '0x';

    return { kind: 'cell', ...output, data: data };
  });

  const inputs = await Promise.all(inputsPromise);

  return [
    { kind: 'tx', txHash, children: inputs },
    { kind: 'tx', txHash, children: outputs },
  ];
}

type HierarchyPoint = HierarchyPointNode<Node>;

function createIllustration([inputsData, outputsData]: TxIo, isMainnet?: boolean): SVGElement {
  const width = 960;
  // const margin = { top: 10, right: 10, bottom: 10, left: 10 };

  const inputsHierarchy = d3.hierarchy<Node>(inputsData);
  const outputsHierarchy = d3.hierarchy<Node>(outputsData);

  const dx = 20;
  const dy = width / (inputsHierarchy.height + outputsHierarchy.height + 1);

  const layoutTree = d3.tree<Node>().nodeSize([dx, dy]);

  const inputs = layoutTree(inputsHierarchy);
  const outputs = layoutTree(outputsHierarchy);

  let x0 = Infinity;
  let x1 = -x0;
  inputs.each((d) => {
    if (d.x > x1) x1 = d.x;
    if (d.x < x0) x0 = d.x;
  });
  outputs.each((d) => {
    if (d.x > x1) x1 = d.x;
    if (d.x < x0) x0 = d.x;
  });

  const height = x1 - x0 + dx * 2;

  const svg = d3
    .create('svg')
    .attr('viewBox', [-dy - dx, x0 - dx, width, height])
    .attr('style', 'max-width: 100%; height: auto;');

  // inputs links
  drawLinks(inputs).attr(
    'd',
    d3
      .linkHorizontal<unknown, HierarchyPoint>()
      .x((d) => -d.y)
      .y((d) => d.x),
  );

  // outputs links
  drawLinks(outputs).attr(
    'd',
    d3
      .linkHorizontal<unknown, HierarchyPoint>()
      .x((d) => d.y)
      .y((d) => d.x),
  );

  function drawLinks(data: HierarchyPoint) {
    return svg
      .append('g')
      .attr('fill', 'none')
      .attr('stroke', '#555')
      .attr('stroke-opacity', 0.4)
      .attr('stroke-width', 1.5)
      .selectAll()
      .data(data.links())
      .join('path');
  }

  const inputNodes = drawNodes(inputs).attr('transform', (d) => `translate(-${d.y},${d.x})`);
  drawCircles(inputNodes);
  drawText(inputNodes);

  const outputNodes = drawNodes(outputs).attr('transform', (d) => `translate(${d.y},${d.x})`);
  drawCircles(outputNodes);
  drawText(outputNodes);

  function drawNodes(data: HierarchyPoint) {
    return svg.append('g').attr('stroke-linejoin', 'round').attr('stroke-width', 3).selectAll().data(data).join('g');
  }

  function drawCircles(selection: d3.Selection<SVGGElement | null, HierarchyPoint, SVGGElement, undefined>) {
    selection
      .append('circle')
      .attr('fill', (d) => (d.children ? '#555' : '#999'))
      .attr('r', ({ data }) => {
        if (data.kind === 'cell') {
          return Math.log10(
            BI.from(data.capacity)
              .div(10 ** 8)
              .toNumber(),
          );
        }
        return 5;
      });
  }

  function drawText(selection: d3.Selection<SVGGElement | null, HierarchyPoint, SVGGElement, undefined>) {
    const lumosConfig = { config: { PREFIX: isMainnet ? 'ckb' : 'ckt', SCRIPTS: {} } } as const;

    selection
      .append('text')
      .text(({ data }) => {
        if (data.kind === 'tx') return truncateMiddle(data.txHash, 6, 4);
        return truncateMiddle(helpers.encodeToAddress(data.lock, lumosConfig));
      })
      .attr('transform', `translate(0,6)`);
  }

  return svg.node()!;
}

function truncateMiddle(str: string, start = 6, end = start) {
  return `${str.slice(0, start)}...${str.slice(-end)}`;
}

export const TransactionIllustration: React.FC<{
  hash: string;
  isMainnet?: boolean;
  url?: string;
}> = ({ hash: txHash, isMainnet, url: inputUrl }) => {
  const [ioNode, setIoNode] = useState<TxIo>();
  const domRef = useRef<HTMLDivElement | null>(null);

  const url = useMemo(() => {
    if (inputUrl) return inputUrl;
    if (isMainnet) return 'https://mainnet.ckb.dev';
    return 'https://testnet.ckb.dev';
  }, [inputUrl, isMainnet]);

  useEffect(() => {
    getTxIo({ txHash, url }).then(setIoNode);
  }, [txHash, url]);

  useEffect(() => {
    if (!ioNode) {
      return;
    }
    domRef.current?.replaceChildren(createIllustration(ioNode, isMainnet));
  }, [ioNode, isMainnet]);

  if (!ioNode) return null;
  return <div style={{ width: '100%', height: '100%' }} ref={domRef}></div>;
};
