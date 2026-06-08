
export const agreementDynamicGuide = {
  tour: 'agreement-dynamic',
  steps: [
    {
      id: 'step-1',
      tour: 'agreement-dynamic',
      icon: <>👋</>,
      title: 'Гэрээт ажлын дэлгэрэнгүй',
      content: (
        <p>
          Гэрээт ажлын дэлгэрэнгүй мэдээлэл авахаас гадна ажилд хамаарах цэг тэмдэгт, хэмжилтүүд, акт зэргийг удирдах боломжтой.
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
      tour: 'agreement-dynamic',
      icon: <>📝</>,
      title: 'Гэрээт ажлын дэлгэрэнгүй',
      content: (
        <p>
          Дэлгэрэнгүй мэдээлэл
        </p>
      ),
      selector: '#agreement-detail',
      side: 'top',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-2',
      tour: 'agreement-dynamic',
      icon: <>📝</>,
      title: 'Гэрээт ажлын дэлгэрэнгүй',
      content: (
        <p>
          Гүйцэтгэгч байгууллагын мэдээлэл
        </p>
      ),
      selector: '#agreement-company',
      side: 'top',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-2',
      tour: 'agreement-dynamic',
      icon: <>📝</>,
      title: 'Гэрээт ажлын дэлгэрэнгүй',
      content: (
        <p>
          Гэрээт ажлын хүрээнд бүртгэгдсэн цэг тэмдэгтийн жагсаалт
        </p>
      ),
      selector: '#service-measure',
      side: 'top',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-2',
      tour: 'agreement-dynamic',
      icon: <>📝</>,
      title: 'Гэрээт ажлын дэлгэрэнгүй',
      content: (
        <p>
          Цэг тэмдэгтэд хэмжилт нэмэх, засах, хуулах мөн сагслах боломжтой.
        </p>
      ),
      selector: '#measurement-edit-0',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-2',
      tour: 'agreement-dynamic',
      icon: <>📝</>,
      title: 'Гэрээт ажлын дэлгэрэнгүй',
      content: (
        <p>
          Ажилтай холбоотой актуудын жагсаалт.
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
      id: 'step-2',
      tour: 'agreement-dynamic',
      icon: <>📝</>,
      title: 'Гэрээт ажлын дэлгэрэнгүй',
      content: (
        <p>
          Энд дарж акт үүсгэх боломжтой. Үүсгэх үед тухайн нутгийн мэргэжилтэнд шийдэх эрх очно.
        </p>
      ),
      selector: '#act-create',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
      perm: 'create'
    },
  ],
}
