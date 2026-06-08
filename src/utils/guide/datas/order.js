import { Box } from "@mui/material";

export const OrderGuide = {
  tour: 'order',
  steps: [
    {
      id: 'step-0',
      tour: 'order',
      icon: <>👋</>,
      title: 'Худалдан авалт',
      content: (
        <p>
          Худалдан авалтын түүх болон төлбөр төлөх хуудас.
        </p>
      ),
      side: 'top',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-2',
      tour: 'order',
      icon: <>📝</>,
      title: 'Худалдан авалтын жагсаалт',
      content: (
        <p>
          Таны нийт худалдан авалтын жагсаалт бүх төлвөөрөө харагдана.
        </p>
      ),
      selector: '#order-table',
      side: 'bottom',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-3',
      tour: 'order',
      icon: <>📝</>,
      title: 'Худалдан авалтын дэлгэрэнгүй',
      content: (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ 
            p: 2, 
            backgroundColor: 'grey.50', 
            borderRadius: 1, 
            border: '1px solid', 
            borderColor: 'grey.200' 
          }}>
            Энд дарснаар тухайн сагсанд ямар хэмжилт, хэд байгааг харах боломжтой. 
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ fontWeight: 'medium', color: 'text.primary' }}>
              Хэрэв та сагсанд хэмжилт нэмэх бол доорхи хуудаснуудад хандаж сагсанд нэмэх боломжтой.
            </Box>
            <Box sx={{ 
              display: 'flex', 
              gap: 2, 
              flexWrap: 'wrap',
              '& > *': { flex: '1 1 auto', minWidth: '120px' }
            }}>
              <Box sx={{ 
                p: 1, 
                borderRadius: 1, 
                backgroundColor: 'primary.50',
                border: '1px solid',
                borderColor: 'primary.200',
                textAlign: 'center',
                transition: 'all 0.2s ease',
                '&:hover': {
                  backgroundColor: 'primary.100',
                  borderColor: 'primary.300'
                }
              }}>
                <a 
                  href="/dashboard/ready" 
                  target="_blank" 
                  rel="noreferrer"
                  style={{ 
                    textDecoration: 'none', 
                    color: 'inherit',
                    fontWeight: 500
                  }}
                >
                  Үйлчилгээ
                </a>
              </Box>
              <Box sx={{ 
                p: 1, 
                borderRadius: 1, 
                backgroundColor: 'secondary.50',
                border: '1px solid',
                borderColor: 'secondary.200',
                textAlign: 'center',
                transition: 'all 0.2s ease',
                '&:hover': {
                  backgroundColor: 'secondary.100',
                  borderColor: 'secondary.300'
                }
              }}>
                <a 
                  href="/dashboard/map" 
                  target="_blank" 
                  rel="noreferrer"
                  style={{ 
                    textDecoration: 'none', 
                    color: 'inherit',
                    fontWeight: 500
                  }}
                >
                  Газрын зураг
                </a>
              </Box>
            </Box>
          </Box>
        </Box>
      ),
      selector: '#order-exp-0',
      side: 'top',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-5',
      tour: 'order',
      icon: <>✏️</>,
      title: 'Төлбөр',
      content: (
        <p>
          Энд дарснаар төлбөр төлөх боломжтой.
        </p>
      ),
      selector: '#order-edit-0',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-6',
      tour: 'order',
      icon: <>✏️</>,
      title: 'Худалдан авалтын төлөв',
      content: (
        <p>
          Энд харагдаж буй хэсэг нь төлвөөс хамаарч өөрчлөгдөнө. Хэрэв төлбөрөө төлсөн бол акт татахад бэлэн байна.
        </p>
      ),
      selector: '#order-download-0',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
  ],
}
