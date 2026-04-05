import type { UIMessage } from 'ai';
import type { ProjectAgentCanvasState, ProjectAgentAssetNodeType, ProjectAgentFeatureNodeType } from '@/lib/project-agent/canvas-state';
import { SYSTEM_AVATARS } from '@/lib/default-avatars';
import { matchesAssetReference } from '@/lib/project-agent/asset-name-match';
import {
  summarizeProjectAgentCanvas,
  type ProjectAgentCanvasAction,
  type ProjectAgentCanvasMutation,
  type ProjectAgentPendingAssetSelectionRequest,
  type ProjectAgentPendingConfirmationRequest,
  type ProjectAgentSelectableAssetType,
} from '@/lib/project-agent/canvas-actions';

export type ProjectAgentCanvasPlan =
  | {
      type: 'inspect_only';
      reply: string;
    }
  | {
      type: 'safe_edit';
      reply: string;
      actions: ProjectAgentCanvasAction[];
    }
  | {
      type: 'asset_selection';
      reply: string;
      request: ProjectAgentPendingAssetSelectionRequest;
    }
  | {
      type: 'confirmation';
      reply: string;
      request: ProjectAgentPendingConfirmationRequest;
    };

const hasTextAfterLatestUserTurn = (messages: UIMessage[]) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const text = message.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text ?? '')
      .join('')
      .trim();

    if (message.role === 'assistant' && text.length > 0) return true;
    if (message.role === 'user' && text.length > 0) return false;
  }

  return false;
};

const buildOpenPickerPlan = (
  assetType: ProjectAgentSelectableAssetType,
  reply: string,
  title: string,
  instructions: string,
  nodeAlias: string,
  mutations: ProjectAgentCanvasMutation[],
): ProjectAgentCanvasPlan => ({
  type: 'asset_selection',
  reply,
  request: {
    type: 'asset_selection',
    assetType,
    title,
    instructions,
    nodeAlias,
    mutations,
  },
});

const buildSafeEditPlan = (reply: string, mutations: ProjectAgentCanvasMutation[]): ProjectAgentCanvasPlan => ({
  type: 'safe_edit',
  reply,
  actions: mutations.map((mutation) => ({
    kind: 'canvas_mutation',
    mutation,
  })),
});

const buildConfirmationPlan = (
  reply: string,
  confirmationType: ProjectAgentPendingConfirmationRequest['confirmationType'],
  title: string,
  message: string,
  mutations: ProjectAgentCanvasMutation[],
): ProjectAgentCanvasPlan => ({
  type: 'confirmation',
  reply,
  request: {
    type: 'confirmation',
    confirmationType,
    title,
    message,
    mutations,
  },
});

const includesAny = (text: string, phrases: string[]) => phrases.some((phrase) => text.includes(phrase));
const includesNegatedPhrase = (text: string, phrase: string) => (
  new RegExp(`\\b(?:do not|don't|dont|avoid|without|keep|no)\\b[\\s\\S]{0,48}${phrase.replace(/\s+/g, '\\s+')}`, 'i').test(text)
);

const CANVAS_BUILD_VERBS = [
  ' add ',
  ' build ',
  ' create ',
  ' place ',
  ' connect ',
  ' wire ',
  ' link ',
  ' format ',
  ' organize ',
  ' arrange ',
  ' clean up ',
  ' tidy ',
  ' select ',
  ' pick ',
  ' choose ',
  ' open ',
  ' inspect ',
  ' show ',
  ' update ',
  ' edit ',
  ' refine ',
];

const LAYOUT_COMMAND_PHRASES = [
  ' format canvas',
  ' format the canvas',
  ' tidy canvas',
  ' tidy the canvas',
  ' organize canvas',
  ' organize the canvas',
  ' reorganize the canvas',
  ' layout canvas',
  ' arrange canvas',
  ' arrange the canvas',
  ' clean up canvas',
  ' clean up the canvas',
  ' clean up the layout',
  ' tidy the layout',
  ' organize the layout',
  ' format the layout',
  ' refine the current canvas',
];

const hasFeatureNodeOnCanvas = (canvas: ProjectAgentCanvasState) => (
  canvas.nodes.some((node) => (
    node.type === 'avatar_ads' ||
    node.type === 'motion_clone' ||
    node.type === 'video_clone'
  ))
);

const isExecutionIntentCommand = (rawText: string, canvas: ProjectAgentCanvasState) => {
  const normalized = ` ${rawText.trim().toLowerCase()} `;
  if (!normalized.trim()) return false;
  if (CANVAS_BUILD_VERBS.some((verb) => normalized.includes(verb))) return false;

  const explicitExecution = (
    /\b(go ahead|continue|proceed)\b/.test(normalized) ||
    /\b(start|run)\b/.test(normalized) ||
    (
      /\bgenerate\b/.test(normalized) &&
      !/\bgenerate\b[\s\w-]{0,24}\b(workflow|node|canvas)\b/.test(normalized) &&
      (
        hasFeatureNodeOnCanvas(canvas) ||
        /\b(it|this|that|now|video|preview|cover|final video)\b/.test(normalized) ||
        [' generate ', ' generate it '].includes(normalized)
      )
    )
  );

  if (!explicitExecution) return false;
  return hasFeatureNodeOnCanvas(canvas) || !includesAny(normalized, [' clone a video ', ' set up video clone ']);
};

const VIDEO_CONTEXT_PHRASES = ['same video', 'same reference video', 'same video context', 'using the same video', 'with the same video', 'with that same video', 'that same video', 'this video', 'that video'];
const PRODUCT_CONTEXT_PHRASES = ['same product', 'the same product', 'with the same product', 'keep the same product', 'this product', 'that product'];
const AVATAR_CONTEXT_PHRASES = ['same avatar', 'the same avatar', 'same person', 'the same person', 'this avatar', 'that avatar', 'this person', 'that person'];

const getFeatureIntent = (text: string): ProjectAgentFeatureNodeType | null => {
  if (includesAny(text, ['motion clone']) && !includesNegatedPhrase(text, 'motion clone')) return 'motion_clone';
  if (includesAny(text, ['avatar ads', 'avatar ad', 'character ads', 'character ad']) && !includesNegatedPhrase(text, 'avatar ads')) return 'avatar_ads';
  if (includesAny(text, ['video clone', 'ugc clone', 'clone node', 'clone workflow', 'clone flow']) && !includesNegatedPhrase(text, 'video clone')) return 'video_clone';
  if (/\bclone(?:d|s|ing)?\b/.test(text) && !includesNegatedPhrase(text, 'clone')) return 'video_clone';
  return null;
};

const getAssetIntent = (text: string): ProjectAgentAssetNodeType | null => {
  if (includesAny(text, [' avatar ', ' avatar.', 'avatar node', 'add avatar'])) return 'avatar';
  if (includesAny(text, [' product ', ' product.', 'product node', 'add product'])) return 'product';
  if (includesAny(text, [' video ', ' video.', 'video node', 'add video'])) return 'video';
  if (includesAny(text, [' text ', 'script node', 'text node'])) return 'text';
  return null;
};

export const planProjectAgentCanvasCommand = (
  rawText: string,
  canvas: ProjectAgentCanvasState,
): ProjectAgentCanvasPlan | null => {
  const text = ` ${rawText.trim().toLowerCase()} `;
  if (!text.trim()) return null;

  if (isExecutionIntentCommand(rawText, canvas)) {
    return {
      type: 'inspect_only',
      reply: hasFeatureNodeOnCanvas(canvas)
        ? 'I can build and arrange the canvas here, but I cannot start workflows from chat. Click Start on the feature node you want to run.'
        : 'I can build and arrange the canvas here, but I cannot start workflows from chat. Add the feature node to the canvas first, then click Start on it when you are ready.',
    };
  }

  if (includesAny(text, [' what is on the canvas', ' inspect canvas', ' show canvas state', ' summarize canvas'])) {
    const summary = summarizeProjectAgentCanvas(canvas);
    return {
      type: 'inspect_only',
      reply: `The canvas has ${summary.nodeCount} nodes and ${summary.edgeCount} edges. Selected: ${summary.selectedSummary}.`,
    };
  }

  if (includesAny(text, [' keep both workflows separate ', ' do not convert either one into motion clone ', ' do not convert either workflow into motion clone '])) {
    return {
      type: 'inspect_only',
      reply: 'I kept the current workflows unchanged.',
    };
  }

  if (includesAny(text, LAYOUT_COMMAND_PHRASES)) {
    return buildSafeEditPlan('I reorganized the canvas layout.', [{ type: 'format_layout' }]);
  }

  if (
    /\bdo not remove the product\b/i.test(text) ||
    /\bdo not switch this (?:into|to) avatar ads\b/i.test(text)
  ) {
    return {
      type: 'inspect_only',
      reply: 'I kept the current workflow unchanged.',
    };
  }

  if (includesAny(text, [' clear canvas', ' reset canvas', ' remove everything'])) {
    return buildConfirmationPlan(
      `This will remove every node and edge from the canvas. Confirm if you want me to clear it.`,
      'clear_canvas',
      'Clear canvas?',
      'This removes every node and edge from the canvas.',
      [{ type: 'clear_canvas' }],
    );
  }

  if (includesAny(text, [' delete selected nodes', ' remove selected nodes', ' delete selected', ' remove selected '])) {
    if (canvas.selectedNodeIds.length <= 1 && !canvas.selectedNodeId) {
      return {
        type: 'inspect_only',
        reply: 'Select at least one node first, then I can delete it.',
      };
    }

    return buildConfirmationPlan(
      'I am ready to delete the current selection. Confirm if you want me to remove those nodes.',
      'delete_nodes',
      'Delete selected nodes?',
      'This removes the current selection and its connected edges.',
      [{ type: 'delete_nodes', targets: [{ kind: 'selected' }] }],
    );
  }

  if (includesAny(text, [' clone a video', ' clone this video', ' i want to clone a video', ' set up video clone'])) {
    return buildOpenPickerPlan(
      'video',
      'Select one reference video below and I will place the video clone flow on the canvas.',
      'Select a video for Video Clone',
      'Choose one reference video. I will place it on the canvas, create a Video Clone node, and connect it automatically.',
      'selectedVideo',
      [
        {
          type: 'add_feature_node',
          alias: 'videoClone',
          featureType: 'video_clone',
          placement: {
            kind: 'relative',
            ref: { kind: 'alias', alias: 'selectedVideo' },
            dx: 280,
            dy: 0,
          },
          select: true,
        },
        {
          type: 'connect_nodes',
          source: { kind: 'alias', alias: 'selectedVideo' },
          target: { kind: 'alias', alias: 'videoClone' },
          targetHandle: 'video',
        },
        {
          type: 'open_node_details',
          target: { kind: 'alias', alias: 'videoClone' },
        },
      ],
    );
  }

  const featureType = getFeatureIntent(text);
  const latestCanvasNodes = [...canvas.nodes].reverse();
  const getOnlyCanvasAsset = (assetType: ProjectAgentAssetNodeType) => {
    const matchingNodes = canvas.nodes.filter((node) => node.type === assetType && node.asset);
    return matchingNodes.length === 1 ? matchingNodes[0]?.asset ?? null : null;
  };
  const findLatestCanvasAsset = (assetType: ProjectAgentAssetNodeType) => (
    latestCanvasNodes.find((node) => node.type === assetType && node.asset)
  );
  const findNamedCanvasAsset = (assetType: ProjectAgentAssetNodeType) => (
    latestCanvasNodes.find((node) => (
      node.type === assetType &&
      Boolean(node.asset?.name) &&
      matchesAssetReference(rawText, node.asset?.name || '')
    ))
  );

  if (featureType) {
    const resolvedVideoAsset = (
      findNamedCanvasAsset('video')?.asset
      || (includesAny(text, VIDEO_CONTEXT_PHRASES) ? findLatestCanvasAsset('video')?.asset : null)
      || getOnlyCanvasAsset('video')
    );
    const resolvedProductAsset = (
      findNamedCanvasAsset('product')?.asset
      || (includesAny(text, PRODUCT_CONTEXT_PHRASES) ? findLatestCanvasAsset('product')?.asset : null)
      || getOnlyCanvasAsset('product')
    );
    const resolvedAvatarAsset = (
      findNamedCanvasAsset('avatar')?.asset
      || (() => {
        const systemAvatar = SYSTEM_AVATARS.find((avatar) => matchesAssetReference(rawText, avatar.avatar_name));
        if (!systemAvatar) return null;
        return {
          id: systemAvatar.id,
          name: systemAvatar.avatar_name,
          imageUrl: systemAvatar.photo_url,
        };
      })()
      || (includesAny(text, AVATAR_CONTEXT_PHRASES) ? findLatestCanvasAsset('avatar')?.asset : null)
      || getOnlyCanvasAsset('avatar')
    );

    if (featureType === 'video_clone' && resolvedVideoAsset && (resolvedProductAsset || resolvedAvatarAsset)) {
      const mutations: ProjectAgentCanvasMutation[] = [
        {
          type: 'add_asset_node',
          alias: 'videoAsset',
          assetType: 'video',
          asset: resolvedVideoAsset,
          reuseExisting: true,
        },
        {
          type: 'add_feature_node',
          alias: 'featureNode',
          featureType: 'video_clone',
          reuseExisting: true,
          select: true,
        },
        {
          type: 'connect_nodes',
          source: { kind: 'alias', alias: 'videoAsset' },
          target: { kind: 'alias', alias: 'featureNode' },
          targetHandle: 'video',
        },
      ];

      if (resolvedProductAsset) {
        mutations.splice(1, 0, {
          type: 'add_asset_node',
          alias: 'productAsset',
          assetType: 'product',
          asset: resolvedProductAsset,
          reuseExisting: true,
        });
        mutations.push({
          type: 'connect_nodes',
          source: { kind: 'alias', alias: 'productAsset' },
          target: { kind: 'alias', alias: 'featureNode' },
          targetHandle: 'product',
        });
      } else if (resolvedAvatarAsset) {
        mutations.splice(1, 0, {
          type: 'add_asset_node',
          alias: 'avatarAsset',
          assetType: 'avatar',
          asset: resolvedAvatarAsset,
          reuseExisting: true,
        });
        mutations.push({
          type: 'connect_nodes',
          source: { kind: 'alias', alias: 'avatarAsset' },
          target: { kind: 'alias', alias: 'featureNode' },
          targetHandle: 'avatar',
        });
      }

      mutations.push({ type: 'format_layout' });
      return buildSafeEditPlan(
        `I added a Video Clone workflow to the canvas with ${resolvedVideoAsset.name}${resolvedProductAsset ? ` and ${resolvedProductAsset.name}` : resolvedAvatarAsset ? ` and ${resolvedAvatarAsset.name}` : ''}.`,
        mutations,
      );
    }

    if (featureType === 'motion_clone' && resolvedVideoAsset && resolvedAvatarAsset) {
      const mutations: ProjectAgentCanvasMutation[] = [
        {
          type: 'add_asset_node',
          alias: 'videoAsset',
          assetType: 'video',
          asset: resolvedVideoAsset,
          reuseExisting: true,
        },
        {
          type: 'add_asset_node',
          alias: 'avatarAsset',
          assetType: 'avatar',
          asset: resolvedAvatarAsset,
          reuseExisting: true,
        },
        {
          type: 'add_feature_node',
          alias: 'featureNode',
          featureType: 'motion_clone',
          reuseExisting: true,
          select: true,
        },
        {
          type: 'connect_nodes',
          source: { kind: 'alias', alias: 'videoAsset' },
          target: { kind: 'alias', alias: 'featureNode' },
          targetHandle: 'video',
        },
        {
          type: 'connect_nodes',
          source: { kind: 'alias', alias: 'avatarAsset' },
          target: { kind: 'alias', alias: 'featureNode' },
          targetHandle: 'avatar',
        },
      ];

      if (resolvedProductAsset) {
        mutations.splice(2, 0, {
          type: 'add_asset_node',
          alias: 'productAsset',
          assetType: 'product',
          asset: resolvedProductAsset,
          reuseExisting: true,
        });
        mutations.push({
          type: 'connect_nodes',
          source: { kind: 'alias', alias: 'productAsset' },
          target: { kind: 'alias', alias: 'featureNode' },
          targetHandle: 'product',
        });
      }

      mutations.push({ type: 'format_layout' });
      return buildSafeEditPlan(
        `I added a Motion Clone workflow to the canvas with ${resolvedAvatarAsset.name}, ${resolvedVideoAsset.name}${resolvedProductAsset ? `, and ${resolvedProductAsset.name}` : ''}.`,
        mutations,
      );
    }

    if (featureType === 'avatar_ads' && resolvedAvatarAsset) {
      const mutations: ProjectAgentCanvasMutation[] = [
        {
          type: 'add_asset_node',
          alias: 'avatarAsset',
          assetType: 'avatar',
          asset: resolvedAvatarAsset,
          reuseExisting: true,
        },
        {
          type: 'add_text_node',
          alias: 'scriptAsset',
          content: resolvedProductAsset
            ? `Introduce ${resolvedProductAsset.name} in a short premium style.`
            : 'Create a concise premium avatar ad script.',
        },
        {
          type: 'add_feature_node',
          alias: 'featureNode',
          featureType: 'avatar_ads',
          reuseExisting: true,
          select: true,
        },
        {
          type: 'connect_nodes',
          source: { kind: 'alias', alias: 'avatarAsset' },
          target: { kind: 'alias', alias: 'featureNode' },
          targetHandle: 'avatar',
        },
        {
          type: 'connect_nodes',
          source: { kind: 'alias', alias: 'scriptAsset' },
          target: { kind: 'alias', alias: 'featureNode' },
          targetHandle: 'text',
        },
      ];

      if (resolvedProductAsset) {
        mutations.splice(1, 0, {
          type: 'add_asset_node',
          alias: 'productAsset',
          assetType: 'product',
          asset: resolvedProductAsset,
          reuseExisting: true,
        });
        mutations.push({
          type: 'connect_nodes',
          source: { kind: 'alias', alias: 'productAsset' },
          target: { kind: 'alias', alias: 'featureNode' },
          targetHandle: 'product',
        });
      }

      mutations.push({ type: 'format_layout' });
      return buildSafeEditPlan(
        `I added an Avatar Ads workflow to the canvas with ${resolvedAvatarAsset.name}${resolvedProductAsset ? ` and ${resolvedProductAsset.name}` : ''}.`,
        mutations,
      );
    }
  }

  if (featureType && featureType !== 'motion_clone' && includesAny(text, [' add ', ' create ', ' insert ', ' place ', ' build ', ' set up '])) {
    return buildSafeEditPlan(
      `I added a ${featureType === 'avatar_ads' ? 'Avatar Ads' : 'Video Clone'} node to the canvas.`,
      [
        {
          type: 'add_feature_node',
          featureType,
          select: true,
        },
      ],
    );
  }

  const assetType = getAssetIntent(text);
  if (assetType === 'text' && includesAny(text, [' add ', ' create ', ' insert ', ' place '])) {
    return buildSafeEditPlan('I added a text node to the canvas.', [
      {
        type: 'add_text_node',
        select: true,
      },
    ]);
  }

  if ((assetType === 'avatar' || assetType === 'product' || assetType === 'video') && includesAny(text, [' add ', ' create ', ' insert ', ' place '])) {
    const featureLabel = assetType === 'avatar' ? 'avatar' : assetType === 'product' ? 'product' : 'video';
    return buildOpenPickerPlan(
      assetType,
      `Select one ${featureLabel} below and I will place it on the canvas.`,
      `Select a ${featureLabel}`,
      `Choose one ${featureLabel}. I will place it on the canvas for you.`,
      assetType === 'avatar' ? 'selectedAvatar' : assetType === 'product' ? 'selectedProduct' : 'selectedVideo',
      [],
    );
  }

  if (includesAny(text, [' open details', ' inspect selected node', ' show selected node'])) {
    return buildSafeEditPlan('I opened the selected node details.', [
      {
        type: 'open_node_details',
        target: { kind: 'selected' },
      },
    ]);
  }

  return null;
};

export const shouldAutoHandleCanvasPlan = (
  plan: ProjectAgentCanvasPlan | null,
  messages: UIMessage[],
) => Boolean(plan) && !hasTextAfterLatestUserTurn(messages);
