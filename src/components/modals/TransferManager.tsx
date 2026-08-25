import React from 'react'
import { TransferPanel, TransferPanelProps } from '~/components/transfer/TransferPanel'

export const TransferManager: React.FC<TransferPanelProps> = (props) => {
  return <TransferPanel {...props} />
}

export { TransferPanel }
