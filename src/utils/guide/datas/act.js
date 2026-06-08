export const ActGuide = {
  tour: 'act',
  steps: [
    {
      id: 'step-1',
      tour: 'act',
      icon: <>👋</>,
      title: 'Актын жагсаалт',
      content: (
        <p>
          Энэ хуудсанд та актын жагсаалттай ажиллах боломжтой. Акт хаана үүсгэх вэ гэж хайж байвал гэрээт ажил тухай бүрд акт үүсгэх ёстойг анхаарна уу.
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
      tour: 'act',
      icon: <>📝</>,
      title: 'Актын жагсаалт',
      content: (
        <p>
          Системд бүртгэлтэй актын жагсаалт.
        </p>
      ),
      selector: '#act-table',
      side: 'bottom',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-5',
      tour: 'act',
      icon: <>✏️</>,
      title: 'Акт татах',
      content: (
        <p>
          Хэрэв акт баталгаажсан бол энд дарж актын PDF файлыг татаж авах боломжтой.
        </p>
      ),
      selector: '#act-download-1',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-5',
      tour: 'act',
      icon: <>✏️</>,
      title: 'Актын явц',
      content: (
        <p>
          Актын явц энд харагдана. Хэрэв та шийдэх эрхтэй бол энд шийдэх цонх дүрслэгдэнэ.
        </p>
      ),
      selector: '#act-status-1',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-5',
      tour: 'act',
      icon: <>✏️</>,
      title: 'Акт устгах',
      content: (
        <p>
          Энд дарснаар тухайн актыг устгах боломжтой.
        </p>
      ),
      selector: '#act-delete-1',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
      perm: 'delete',
    },
  ],
}
