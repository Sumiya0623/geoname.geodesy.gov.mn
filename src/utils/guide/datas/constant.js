
export const ConstantGuide = {
  tour: 'constant',
  steps: [
    {
      id: 'step-1',
      tour: 'constant',
      icon: <>👋</>,
      title: 'Тогтмол утга',
      content: (
        <p>
          Системд ашиглагдаж буй тогтмол утгууд.
        </p>
      ),
      side: 'top',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-3',
      tour: 'constant',
      icon: <>📝</>,
      title: 'Тогтмол үүсгэх',
      content: (
        <p>
          Энд дарснаар шинэ тогтмол үүсгэх боломжтой.
        </p>
      ),
      selector: '#constant-create',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
      perm: 'create',
    },
    {
      id: 'step-2',
      tour: 'constant',
      icon: <>📝</>,
      title: 'Тогтмолын жагсаалт',
      content: (
        <p>
          Энд дүрслэгдэж буй утгуудыг системийн гүнд хүртэл ашигладаг тул зайлшгүй шаардлага гархаас бусад тохиолдолд
          дураараа устгаж засахгүй байхыг анхааруулъя.
        </p>
      ),
      selector: '#constant-table',
      side: 'bottom',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-4',
      tour: 'constant',
      icon: <>📝</>,
      title: 'Тогтмол засах устгах',
      content: (
        <p>
          Энд дарснаар тогтмол утгыг засах устгах боломжтой.
        </p>
      ),
      selector: '#constant-update-1',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
      perm: 'update',
    },
  ]
}
