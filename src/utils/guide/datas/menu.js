
export const MenuGuide = {
  tour: 'menu',
  steps: [
    {
      id: 'step-1',
      tour: 'menu',
      icon: <>👋</>,
      title: 'Хэрэглэгчийн цэс',
      content: (
        <p>
          Системд ашиглагдаж буй хэрэглэгчийн цэсийг эндээс удирдах боломжтой.
        </p>
      ),
      side: 'top',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-4',
      tour: 'menu',
      icon: <>📝</>,
      title: 'Цэс үүсгэх',
      content: (
        <p>
          Энд дарснаар шинэ цэс үүсгэх боломжтой.
        </p>
      ),
      selector: '#menu-create',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
      perm: 'create',
    },
    {
      id: 'step-2',
      tour: 'menu',
      icon: <>📝</>,
      title: 'Цэсний жагсаалт',
      content: (
        <p>
          Цэсний бүлэг төрөл болон түүнд хамаарах цэснүүдийн жагсаалтыг эндээс харах боломжтой.
        </p>
      ),
      selector: '#menu-table',
      side: 'bottom',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-3',
      tour: 'menu',
      icon: <>📝</>,
      title: 'Цэсний жагсаалт',
      content: (
        <p>
          Дэд цэсийг энд дарж задлаж харах боломжтой.
        </p>
      ),
      selector: '#menu-exp-1',
      side: 'right',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-5',
      tour: 'menu',
      icon: <>✏️</>,
      title: 'Цэс засах',
      content: (
        <p>
          Энд дарснаар устгах, засварлах боломжтой.
        </p>
      ),
      selector: '#menu-edit-1',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
      perm: 'update',
    },
    {
      id: 'step-6',
      tour: 'menu',
      icon: <>✏️</>,
      title: 'Цэс хуулах',
      content: (
        <p>
          Энд дарснаар хуулах боломжтой.
        </p>
      ),
      selector: '#menu-dup-1',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
      perm: 'copy',
    },
    {
      id: 'step-7',
      tour: 'menu',
      icon: <>✏️</>,
      title: 'Дэд цэс нэмэх',
      content: (
        <p>
          Энд дарснаар дэд цэс нэмэх боломжтой.
        </p>
      ),
      selector: '#menu-add-1',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
      perm: 'create',
    },
    {
      id: 'step-8',
      tour: 'menu',
      icon: <>✏️</>,
      title: 'Дэд цэс',
      content: (
        <p>
          Энд харагдаж буй тоо нь тухайн бүлгийн харагдах дарааллийг илэрхийлнэ.
        </p>
      ),
      selector: '#menu-order-1',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
  ],
}
