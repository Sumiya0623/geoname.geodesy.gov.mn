import React from 'react'
import View401 from 'src/sections/error/401-view'

export const metadata = {
  title: 'Та нэвтэрнэ үү',
  description: '',
}

function page() {
  return (
    <div style={{
        width:'100vw',
        height:'100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
    }}>
        <View401/>
    </div>
  )
}

export default page