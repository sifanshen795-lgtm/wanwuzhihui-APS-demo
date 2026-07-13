import { Button, Card, Drawer, Modal, Select, Space, Table, Typography, message } from 'antd';
import { DeleteOutlined, HolderOutlined } from '@ant-design/icons';
import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import type { ProductionCraft, ProductionCraftEdge, ProductionCraftNode, ProductionCraftNodeMaterial } from '../domain/models/mes';
import type { MesStateData } from '../domain/models/mes';

const NODE_WIDTH = 160;
const NODE_HEIGHT = 56;
const NODE_START_X = 80;
const NODE_Y = 120;

const normalizeNodes = (nodes: ProductionCraftNode[]) => nodes
  .sort((a, b) => a.sortOrder - b.sortOrder)
  .map((node, index) => ({
    ...node,
    sortOrder: node.sortOrder ?? index + 1,
    x: node.x ?? NODE_START_X + index * 220,
    y: node.y ?? NODE_Y,
  }));

type NodeDragState = {
  nodeId: string;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
};

type ProductionCraftConfiguratorProps = {
  open: boolean;
  craft: ProductionCraft | null;
  processes: MesStateData['productionProcesses'];
  materials: MesStateData['materials'];
  onCancel: () => void;
  onSave: (payload: Pick<ProductionCraft, 'nodes' | 'edges'>) => void;
};

export function ProductionCraftConfigurator({
  open,
  craft,
  processes,
  materials,
  onCancel,
  onSave,
}: ProductionCraftConfiguratorProps) {
  const [nodes, setNodes] = useState<ProductionCraftNode[]>([]);
  const [edges, setEdges] = useState<ProductionCraftEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draggingProcessCode, setDraggingProcessCode] = useState<string | null>(null);
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const nodeDragRef = useRef<NodeDragState | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    if (!open || !craft) return;
    const nextNodes = normalizeNodes(craft.nodes.map((item) => ({ ...item, materials: item.materials.map((material) => ({ ...material })) })));
    setNodes(nextNodes);
    setEdges(craft.edges.map((item) => ({ ...item })));
    setSelectedNodeId(nextNodes[0]?.id ?? null);
    setSettingsOpen(false);
    setConnectingSourceId(null);
    setSelectedEdgeId(null);
  }, [craft, open]);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      const drag = nodeDragRef.current;
      if (!drag) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        drag.moved = true;
      }
      setNodes((prev) => prev.map((node) => node.id === drag.nodeId
        ? { ...node, x: Math.max(0, drag.originX + dx), y: Math.max(0, drag.originY + dy) }
        : node));
    };
    const handleMouseUp = () => {
      if (nodeDragRef.current) {
        suppressClickRef.current = Boolean(nodeDragRef.current.moved);
      }
      nodeDragRef.current = null;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const selectedNode = useMemo(
    () => nodes.find((item) => item.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId],
  );

  const processNameMap = useMemo(
    () => new Map(processes.map((item) => [item.code, item.name])),
    [processes],
  );

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!draggingProcessCode) return;
    const exists = nodes.some((item) => item.processCode === draggingProcessCode);
    if (exists) {
      message.warning('该工序已在工艺中');
      setDraggingProcessCode(null);
      return;
    }
    const stage = stageRef.current;
    const rect = stage?.getBoundingClientRect();
    const x = rect && stage ? event.clientX - rect.left + stage.scrollLeft - NODE_WIDTH / 2 : NODE_START_X + nodes.length * 220;
    const y = rect && stage ? event.clientY - rect.top + stage.scrollTop - NODE_HEIGHT / 2 : NODE_Y;
    const nextNode: ProductionCraftNode = {
      id: `node-${Date.now()}`,
      processCode: draggingProcessCode,
      x: Math.max(0, x),
      y: Math.max(0, y),
      sortOrder: nodes.length + 1,
      materials: [],
    };
    setNodes([...nodes, nextNode]);
    setSelectedNodeId(nextNode.id);
    setSelectedEdgeId(null);
    setSettingsOpen(false);
    setDraggingProcessCode(null);
  };

  const removeNode = (nodeId: string) => {
    const nextNodes = nodes.filter((item) => item.id !== nodeId);
    setNodes(nextNodes);
    setEdges((prev) => prev.filter((edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId));
    setSelectedEdgeId((edgeId) => (edges.some((edge) => edge.id === edgeId && (edge.sourceNodeId === nodeId || edge.targetNodeId === nodeId)) ? null : edgeId));
    if (selectedNodeId === nodeId) setSelectedNodeId(nextNodes[0]?.id ?? null);
    if (selectedNodeId === nodeId) setSettingsOpen(false);
    if (connectingSourceId === nodeId) setConnectingSourceId(null);
  };

  const startNodeDrag = (event: ReactMouseEvent<HTMLDivElement>, node: ProductionCraftNode) => {
    if ((event.target as HTMLElement).closest('button') || (event.target as HTMLElement).closest('.craft-canvas-node-anchor')) return;
    nodeDragRef.current = {
      nodeId: node.id,
      startX: event.clientX,
      startY: event.clientY,
      originX: node.x,
      originY: node.y,
      moved: false,
    };
  };

  const connectToNode = (targetNodeId: string) => {
    if (!connectingSourceId) return false;
    if (connectingSourceId === targetNodeId) {
      setConnectingSourceId(null);
      return true;
    }
    const exists = edges.some((edge) => edge.sourceNodeId === connectingSourceId && edge.targetNodeId === targetNodeId);
    if (exists) {
      message.warning('该连线已存在');
      setConnectingSourceId(null);
      return true;
    }
    setEdges((prev) => [...prev, {
      id: `edge-${connectingSourceId}-${targetNodeId}-${Date.now()}`,
      sourceNodeId: connectingSourceId,
      targetNodeId,
    }]);
    setSelectedEdgeId(null);
    setConnectingSourceId(null);
    return true;
  };

  const updateNodeMaterials = (materialsList: ProductionCraftNodeMaterial[]) => {
    if (!selectedNode) return;
    setNodes((prev) => prev.map((item) => item.id === selectedNode.id ? { ...item, materials: materialsList } : item));
  };

  const addMaterial = () => {
    if (!selectedNode) return;
    const material = materials[0];
    if (!material) return;
    updateNodeMaterials([
      ...selectedNode.materials,
      {
        id: `mat-${Date.now()}`,
        materialCode: material.code,
      },
    ]);
  };

  return (
    <Modal
      title={`工艺配置${craft ? ` - ${craft.name}` : ''}`}
      open={open}
      onCancel={onCancel}
      onOk={() => onSave({ nodes, edges })}
      okText="确定"
      cancelText="取消"
      width={1280}
      destroyOnClose
      styles={{ body: { paddingTop: 12 } }}
    >
      <div className="craft-configurator-layout">
        <Card size="small" title="工序" className="craft-configurator-panel">
          <Space direction="vertical" style={{ width: '100%' }}>
            {processes.filter((item) => item.enabled).map((item) => (
              <Button
                key={item.code}
                block
                draggable
                icon={<HolderOutlined />}
                onDragStart={() => setDraggingProcessCode(item.code)}
                onDragEnd={() => setDraggingProcessCode(null)}
              >
                {item.name}
              </Button>
            ))}
          </Space>
        </Card>

        <Card
          size="small"
          title="工艺画布"
          className="craft-configurator-canvas"
          extra={(
            <Space>
              {connectingSourceId ? (
                <Typography.Text type="secondary">
                  拖到目标工序后松开完成连线
                </Typography.Text>
              ) : null}
              <Button
                size="small"
                disabled={!selectedEdgeId}
                onClick={() => {
                  if (!selectedEdgeId) return;
                  setEdges((prev) => prev.filter((edge) => edge.id !== selectedEdgeId));
                  setSelectedEdgeId(null);
                }}
              >
                删除选中连线
              </Button>
              <Button size="small" disabled={!edges.length} onClick={() => { setEdges([]); setSelectedEdgeId(null); }}>清空连线</Button>
            </Space>
          )}
          onDragOver={(event) => event.preventDefault()}
          onDrop={handleDrop}
        >
          <div className="craft-canvas-stage" ref={stageRef}>
            <svg className="craft-canvas-edges">
              {edges.map((edge) => {
                const source = nodes.find((item) => item.id === edge.sourceNodeId);
                const target = nodes.find((item) => item.id === edge.targetNodeId);
                if (!source || !target) return null;
                const x1 = source.x + NODE_WIDTH;
                const y1 = source.y + NODE_HEIGHT / 2;
                const x2 = target.x;
                const y2 = target.y + NODE_HEIGHT / 2;
                return (
                  <g key={edge.id}>
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke="transparent"
                      strokeWidth={14}
                      className="craft-canvas-edge-hit"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedEdgeId(edge.id);
                        setSelectedNodeId(null);
                        setSettingsOpen(false);
                      }}
                    />
                    <line
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={selectedEdgeId === edge.id ? '#ffb800' : '#2f9e8f'}
                      strokeWidth={selectedEdgeId === edge.id ? 3 : 2}
                      markerEnd="url(#arrow)"
                      className="craft-canvas-edge-line"
                    />
                  </g>
                );
              })}
              <defs>
                <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#2f9e8f" />
                </marker>
              </defs>
            </svg>
            {nodes.map((node) => (
              <div
                key={node.id}
                className={`craft-canvas-node${selectedNodeId === node.id ? ' is-selected' : ''}${connectingSourceId === node.id ? ' is-connecting' : ''}`}
                style={{ left: node.x, top: node.y, width: NODE_WIDTH, height: NODE_HEIGHT }}
                onMouseDown={(event) => startNodeDrag(event, node)}
                onMouseUp={() => {
                  if (connectingSourceId) {
                    suppressClickRef.current = connectToNode(node.id);
                  }
                }}
                onClick={() => {
                  if (suppressClickRef.current) {
                    suppressClickRef.current = false;
                    return;
                  }
                  setSelectedNodeId(node.id);
                  setSelectedEdgeId(null);
                  setSettingsOpen(true);
                }}
              >
                <div className="craft-canvas-node-title">{processNameMap.get(node.processCode) ?? node.processCode}</div>
                <Space size={4}>
                  <Button size="small" type="link" danger icon={<DeleteOutlined />} onClick={(event) => { event.stopPropagation(); removeNode(node.id); }} />
                </Space>
                <span
                  className="craft-canvas-node-anchor"
                  title="按住拖拽到目标工序连线"
                  onMouseDown={(event) => {
                    event.stopPropagation();
                    setSelectedNodeId(node.id);
                    setSettingsOpen(false);
                    setConnectingSourceId(node.id);
                  }}
                  onClick={(event) => event.stopPropagation()}
                />
              </div>
            ))}
            {!nodes.length && <Typography.Text type="secondary">从左侧拖拽工序到画布</Typography.Text>}
          </div>
        </Card>
      </div>
      <Drawer
        title={selectedNode ? `${processNameMap.get(selectedNode.processCode) ?? selectedNode.processCode} - 工序设置` : '工序设置'}
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        width={720}
        getContainer={false}
        styles={{ body: { paddingTop: 12 } }}
        extra={selectedNode ? <Button type="primary" onClick={addMaterial}>添加物料</Button> : null}
      >
        {selectedNode ? (
          <Table
            rowKey="id"
            size="small"
            pagination={false}
            dataSource={selectedNode.materials}
            scroll={{ x: 760 }}
            columns={[
              {
                title: '投料物料',
                dataIndex: 'materialCode',
                width: 360,
                render: (value, row) => (
                  <Select
                    showSearch
                    optionFilterProp="label"
                    style={{ width: 320 }}
                    value={value}
                    options={materials.map((item) => ({ value: item.code, label: `${item.code} - ${item.name}` }))}
                    onChange={(nextCode) => {
                      updateNodeMaterials(selectedNode.materials.map((item) => item.id === row.id ? {
                        ...item,
                        materialCode: nextCode,
                      } : item));
                    }}
                  />
                ),
              },
              {
                title: '操作',
                width: 80,
                render: (_, row) => (
                  <Button
                    type="link"
                    danger
                    onClick={() => updateNodeMaterials(selectedNode.materials.filter((item) => item.id !== row.id))}
                  >
                    删除
                  </Button>
                ),
              },
            ]}
          />
        ) : (
          <Typography.Text type="secondary">点击画布中的工序节点后配置投料物料</Typography.Text>
        )}
      </Drawer>
    </Modal>
  );
}
