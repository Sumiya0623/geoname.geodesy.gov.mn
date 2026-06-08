
export const UnitGuide = {
  tour: 'au',
  steps: [
    {
      id: 'step-1',
      tour: 'au',
      icon: <>👋</>,
      title: 'Засаг захиргааны нэгж',
      content: (
        <p>
          Системд ашиглагдаж буй засаг захиргааны нэгжийг эндээс удирдах боломжтой.
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
      tour: 'au',
      icon: <>📝</>,
      title: 'Нэгж үүсгэх',
      content: (
        <p>
          Энд дарснаар шинэ нэгж үүсгэх боломжтой.
        </p>
      ),
      selector: '#unit-create',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
      perm: 'create',
    },
    {
      id: 'step-2',
      tour: 'au',
      icon: <>📝</>,
      title: 'Нэгжийн жагсаалт',
      content: (
        <p>
          Нэгжийн бүлэг төрөл болон түүнд хамаарах сумын жагсаалтыг эндээс харах боломжтой.
        </p>
      ),
      selector: '#unit-table',
      side: 'bottom',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-3',
      tour: 'au',
      icon: <>📝</>,
      title: 'Нэгжийн жагсаалт',
      content: (
        <p>
          Сумын жагсаалтыг энд дарж задлаж харах боломжтой.
        </p>
      ),
      selector: '#unit-exp-1',
      side: 'right',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-5',
      tour: 'au',
      icon: <>✏️</>,
      title: 'Нэгж засах',
      content: (
        <p>
          Энд дарснаар устгах, засварлах боломжтой.
        </p>
      ),
      selector: '#unit-edit-1',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
      perm: 'update',
    },
    {
      id: 'step-6',
      tour: 'au',
      icon: <>✏️</>,
      title: 'Нэгж хуулах',
      content: (
        <p>
          Энд дарснаар хуулах боломжтой.
        </p>
      ),
      selector: '#unit-dup-1',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
      perm: 'copy',
    },
    {
      id: 'step-7',
      tour: 'au',
      icon: <>✏️</>,
      title: 'Сум нэмэх',
      content: (
        <p>
          Энд дарснаар сум нэмэх боломжтой.
        </p>
      ),
      selector: '#unit-add-1',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
      perm: 'create',
    },
    {
      id: 'step-8',
      tour: 'au',
      icon: <>✏️</>,
      title: 'Сумын дараалал',
      content: (
        <p>
          Энд харагдаж буй тоо нь тухайн аймагт хэдэн сум байгааг илэрхийлнэ.
        </p>
      ),
      selector: '#unit-count-1',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
  ],
}
