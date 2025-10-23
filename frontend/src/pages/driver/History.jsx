import React from 'react'
import OrderListBase from './OrderListBase.jsx'

export default function DriverHistory(){
  return (
    <OrderListBase
      title="Order History"
      subtitle="All your delivered and cancelled orders"
      endpoint="/api/orders/driver/history"
      showTotalCollected={true}
      withFilters
    />
  )
}
