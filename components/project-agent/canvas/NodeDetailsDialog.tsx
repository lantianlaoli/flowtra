'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import {
  isProjectAgentFeatureNode,
  type ProjectAgentCanvasMilestone,
  type ProjectAgentCanvasNode,
} from '@/lib/project-agent/canvas-state';

type NodeDetailsDialogProps = {
  node: ProjectAgentCanvasNode | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const getMilestoneIcon = (milestone: ProjectAgentCanvasMilestone) => {
  if (milestone.state === 'completed') {
    return <CheckCircle2 className="h-4.5 w-4.5 text-[#0f0f0f]" />;
  }
  if (milestone.state === 'active') {
    return <Loader2 className="h-4.5 w-4.5 animate-spin text-[#0f0f0f]" />;
  }
  if (milestone.state === 'failed') {
    return <AlertCircle className="h-4.5 w-4.5 text-[#8a3d3d]" />;
  }
  return <span className="block h-2.5 w-2.5 rounded-full bg-[#d2cdc0]" />;
};

export default function NodeDetailsDialog({
  node,
  open,
  onOpenChange,
}: NodeDetailsDialogProps) {
  const featureNode = node && isProjectAgentFeatureNode(node.type) ? node : null;
  const milestones = featureNode?.runtime?.milestones || [];
  const missingInputs = featureNode?.runtime?.missingInputs || [];

  return (
    <Dialog.Root onOpenChange={onOpenChange} open={open && Boolean(featureNode)}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-[32px] border border-[#ddd9cd] bg-white p-6 shadow-[0_30px_80px_rgba(0,0,0,0.22)]">
          {featureNode ? (
            <>
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#7b7b75]">Workflow Progress</p>
                  <Dialog.Title className="mt-2 text-2xl font-semibold text-black">{featureNode.label}</Dialog.Title>
                  <Dialog.Description className="mt-2 text-sm leading-6 text-[#65655f]">
                    {featureNode.runtime?.statusLabel || 'Waiting for input connections.'}
                  </Dialog.Description>
                </div>
                <Dialog.Close className="rounded-full border border-[#ddd8cc] px-3 py-2 text-xs font-medium text-black">
                  Close
                </Dialog.Close>
              </div>

              {missingInputs.length > 0 ? (
                <div className="mt-5 rounded-[24px] border border-[#f0d6d6] bg-[#fff5f5] px-4 py-3 text-sm text-[#8a3d3d]">
                  Missing inputs: {missingInputs.join(', ')}
                </div>
              ) : null}

              {featureNode.runtime?.error ? (
                <div className="mt-5 rounded-[24px] border border-[#f0d6d6] bg-[#fff5f5] px-4 py-3 text-sm text-[#8a3d3d]">
                  {featureNode.runtime.error}
                </div>
              ) : null}

              <div className="mt-5 space-y-3">
                {milestones.map((milestone) => (
                  <div
                    key={milestone.key}
                    className={`flex items-center gap-3 rounded-[22px] border px-4 py-3 ${
                      milestone.state === 'failed'
                        ? 'border-[#f0d6d6] bg-[#fff5f5]'
                        : milestone.state === 'active'
                          ? 'border-[#d9d5ca] bg-[#faf8f2]'
                          : milestone.state === 'completed'
                            ? 'border-[#ddd9cd] bg-white'
                            : 'border-[#ece7da] bg-[#fcfbf8]'
                    }`}
                  >
                    {getMilestoneIcon(milestone)}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-black">{milestone.label}</p>
                      <p className="mt-0.5 text-xs text-[#75756f]">
                        {milestone.state === 'active'
                          ? 'In progress'
                          : milestone.state === 'completed'
                            ? 'Completed'
                            : milestone.state === 'failed'
                              ? 'Failed'
                              : 'Waiting'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {featureNode.runtime?.outputUrl ? (
                <a
                  className="mt-6 inline-flex rounded-full border border-black px-4 py-2.5 text-sm font-medium text-black"
                  href={featureNode.runtime.outputUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Open final video
                </a>
              ) : null}
            </>
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
