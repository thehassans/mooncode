import React from 'react'
import OrderListBase from './OrderListBase.jsx'

export default function DriverDelivered(){
  return (
    <OrderListBase
      title="Delivered Orders"
      subtitle="All orders you have delivered"
      endpoint="/api/orders/driver/delivered"
      withFilters
    />
  )
}
