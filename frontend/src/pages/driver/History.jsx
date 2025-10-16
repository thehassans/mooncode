import React from 'react'
import OrderListBase from './OrderListBase.jsx'

export default function DriverHistory(){
  return (
    <OrderListBase
      title="Order History"
      subtitle="Delivered orders archive"
      endpoint="/api/orders/driver/history"
      showTotalCollected
      showMap={false}
      withFilters
      withRange
    />
  )
}
