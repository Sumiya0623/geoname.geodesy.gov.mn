import React, { useState } from 'react';
import { useGetLevelsFordropdown } from 'src/api/level';
import Iconify from 'src/components/iconify';

export default function LevelSelector({ level2Id = null, value = null, onChange = () => {}, radioName = 'levelRadio3' }) {
  const { levels: level1List, levelsLoading: level1Loading } = useGetLevelsFordropdown({ level1: '' });
  const [expandedL1, setExpandedL1] = useState(level2Id ? null : null);

  if (level1Loading) return <div style={{ color: '#64748b' }}>Ачааллаж байна...</div>;
  if (!level1List || !level1List.length) return <div style={{ color: '#64748b' }}>Өгөгдөл алга</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {level1List.map((l1) => (
        <div key={l1.id} style={{ borderRadius: 8, padding: '6px 8px', background: '#fff' }}>
          <Level1Item
            l1={l1}
            expanded={expandedL1 === l1.id}
            onToggle={() => setExpandedL1(expandedL1 === l1.id ? null : l1.id)}
            value={value}
            onChange={onChange}
            preexpandLevel2Id={level2Id}
            radioName={radioName}
          />
        </div>
      ))}
    </div>
  );
}

function Level1Item({ l1, expanded, onToggle, value, onChange, preexpandLevel2Id, radioName }) {
  const { levels: level2List, levelsLoading: level2Loading } = useGetLevelsFordropdown(expanded ? { level1: l1.id } : null);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div onClick={onToggle} style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <Iconify icon={expanded ? 'eva:chevron-down-fill' : 'eva:chevron-right-fill'} width={16} height={16} />
          </div>
          <div style={{ fontWeight: 600 }}>{l1.name}</div>
        </div>
        <div style={{ color: '#94a3b8', fontSize: 12 }}>{level2Loading ? '...' : (level2List || []).length}</div>
      </div>
      {expanded && (
        <div style={{ marginLeft: 18, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {level2Loading && <div style={{ color: '#64748b' }}>Ачааллаж байна...</div>}
          {!level2Loading && (!level2List || level2List.length === 0) && <div style={{ color: '#64748b' }}>Дэд түвшин алга</div>}
          {!level2Loading && level2List && level2List.map((l2) => (
            <Level2Item key={l2.id} l2={l2} value={value} onChange={onChange} preexpand={preexpandLevel2Id === l2.id} radioName={radioName} />
          ))}
        </div>
      )}
    </div>
  );
}

function Level2Item({ l2, value, onChange, preexpand = false, radioName }) {
  const [expanded, setExpanded] = useState(preexpand);
  const { levels: level3List, levelsLoading: level3Loading } = useGetLevelsFordropdown(expanded ? { level2: l2.id } : null);

  return (
    <div style={{ borderLeft: '2px dashed rgba(0,0,0,0.04)', paddingLeft: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div onClick={() => setExpanded((s) => !s)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
            <Iconify icon={expanded ? 'eva:chevron-down-fill' : 'eva:chevron-right-fill'} width={14} height={14} />
          </div>
          <div style={{ fontWeight: 500 }}>{l2.name}</div>
        </div>
        <div style={{ color: '#94a3b8', fontSize: 12 }}>{level3Loading ? '...' : (level3List || []).length}</div>
      </div>

      {expanded && (
        <div style={{ marginLeft: 14, marginTop: 6, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {level3Loading && <div style={{ color: '#64748b' }}>Ачааллаж байна...</div>}
          {!level3Loading && (!level3List || level3List.length === 0) && <div style={{ color: '#64748b' }}>3-р түвшин алга</div>}
          {!level3Loading && level3List && level3List.map((l3) => (
            <label key={l3.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="radio" name={radioName} checked={String(value) === String(l3.id)} onChange={() => onChange(l3.id, l3.name)} />
              <span style={{ fontSize: 14 }}>{l3.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
