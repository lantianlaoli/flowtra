import type {
  ProjectAgentCanvasEdge,
  ProjectAgentCanvasNode,
  ProjectAgentCanvasState,
} from '@/lib/project-agent/canvas-state';

export type ProjectAgentInstructionSemanticRole =
  | 'instruction'
  | 'script'
  | 'edit_instruction'
  | 'product_guidance';

export type ProjectAgentInstructionSemanticPresentation = {
  label: string;
  placeholder: string;
};

export const getInstructionSemanticPresentation = (
  role: ProjectAgentInstructionSemanticRole
): ProjectAgentInstructionSemanticPresentation => {
  switch (role) {
    case 'script':
      return {
        label: 'Script',
        placeholder: 'Write what the avatar should say...',
      };
    case 'edit_instruction':
      return {
        label: 'Edit Instruction',
        placeholder: 'Describe how to change the source video...',
      };
    case 'product_guidance':
      return {
        label: 'Product Guidance',
        placeholder: 'Describe how the product should appear or behave...',
      };
    default:
      return {
        label: 'Instruction',
        placeholder: 'Write an instruction...',
      };
  }
};

const getNodeById = (state: ProjectAgentCanvasState, nodeId: string) => (
  state.nodes.find((node) => node.id === nodeId) || null
);

const getIncomingFeatureInputs = (
  state: ProjectAgentCanvasState,
  featureNodeId: string,
  extraEdge?: ProjectAgentCanvasEdge | null
) => {
  const relevantEdges = [
    ...state.edges.filter((edge) => edge.targetNodeId === featureNodeId),
    ...(extraEdge && extraEdge.targetNodeId === featureNodeId ? [extraEdge] : []),
  ];
  return new Set(relevantEdges.map((edge) => edge.targetHandle));
};

const getRoleForFeature = (
  state: ProjectAgentCanvasState,
  featureNode: ProjectAgentCanvasNode,
  extraEdge?: ProjectAgentCanvasEdge | null
): ProjectAgentInstructionSemanticRole => {
  if (featureNode.type === 'avatar_ads') {
    return 'script';
  }

  if (featureNode.type === 'video_clone') {
    const inputs = getIncomingFeatureInputs(state, featureNode.id, extraEdge);
    return inputs.has('avatar') || inputs.has('product')
      ? 'product_guidance'
      : 'edit_instruction';
  }

  return 'instruction';
};

export const getInstructionSemanticRole = (
  state: ProjectAgentCanvasState,
  textNodeId: string
): ProjectAgentInstructionSemanticRole => {
  const connectedTextEdges = state.edges.filter(
    (edge) => edge.sourceNodeId === textNodeId && edge.targetHandle === 'text'
  );
  const roles = connectedTextEdges
    .map((edge) => getNodeById(state, edge.targetNodeId))
    .filter((node): node is ProjectAgentCanvasNode => Boolean(node))
    .map((node) => getRoleForFeature(state, node));

  return roles[0] || 'instruction';
};

export const getProposedInstructionSemanticRole = (
  state: ProjectAgentCanvasState,
  edge: ProjectAgentCanvasEdge
): ProjectAgentInstructionSemanticRole => {
  const targetNode = getNodeById(state, edge.targetNodeId);
  if (!targetNode) return 'instruction';
  return getRoleForFeature(state, targetNode, edge);
};

export const formatInstructionSemanticRoleLabel = (
  role: ProjectAgentInstructionSemanticRole
) => getInstructionSemanticPresentation(role).label;
