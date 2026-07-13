import { InfoCircleOutlined } from '@ant-design/icons';
import { Button, Pagination } from 'antd';
import type { ReactNode } from 'react';

type SelectedCountTextProps = {
  selectedCount: number;
  currentPageSelectedCount?: number;
};

export function SelectedCountText({ selectedCount, currentPageSelectedCount = selectedCount }: SelectedCountTextProps) {
  return (
    <span className="selected-count-text">
      已选：{selectedCount}（当页已选：{currentPageSelectedCount}）
    </span>
  );
}

export function TableToolIcons() {
  return (
    <>
      <Button shape="circle">⌕</Button>
      <Button shape="circle">⚙</Button>
      <Button shape="circle">↻</Button>
      <Button shape="circle">⤢</Button>
      <Button shape="circle">☷</Button>
    </>
  );
}

type ListPageFooterProps = {
  note?: ReactNode;
  current?: number;
  pageSize?: number;
  total?: number;
  onChange?: (page: number) => void;
};

export function ListPageFooter({
  note,
  current = 1,
  pageSize = 10,
  total = 0,
  onChange,
}: ListPageFooterProps) {
  if (!note && !onChange) return null;

  return (
    <div className="list-page-footer" style={!note ? { justifyContent: 'flex-end' } : undefined}>
      {note ? (
        <div className="list-page-footer-note">
          <InfoCircleOutlined className="list-page-footer-icon" />
          <span>{note}</span>
        </div>
      ) : null}
      {onChange ? (
        <Pagination
          current={current}
          pageSize={pageSize}
          total={total}
          showSizeChanger={false}
          onChange={onChange}
        />
      ) : null}
    </div>
  );
}
