export const AccessGuide = {
  tour: 'access',
  steps: [
      {
        id: 'step-1',
        tour: 'access',
        icon: <>👋</>,
        title: 'Хандалтын заавар',
        content: (
          <p>
            Энэ хуудсанд та системд хийгдсэн бүх үйлдлийн түүхийг харах боломжтой.
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
        tour: 'access',
        icon: <>🚀</>,
        title: 'Үйлдлийн төрлүүд',
        content: (
          <p>Үйлдлүүдэд хамаарах нийт хүсэлтүүдийн жагсаалт. Энд дарснаар доорхи графикийг шүүж харах боломжтой..</p>
        ),
        selector: '#access-tour1',
        side: 'bottom',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 10,
        scrollOffset: 120,
      },
      {
        id: 'step-3',
        tour: 'access',
        icon: <>🚀</>,
        title: 'Үйлдлийн график',
        content: (
          <p>Үйлдлүүдийг нийт болон үйлдлийн төрлөөр харуулах график.</p>
        ),
        selector: '#access-tour2',
        side: 'bottom',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 10,
        scrollOffset: 120,
      },
      {
        id: 'step-3',
        tour: 'access',
        icon: <>🚀</>,
        title: 'Нэвтэрсэн түүх',
        content: (
          <p>Хэрэглэгчдийн нэвтэрсэн түүх.</p>
        ),
        selector: '#access-tour3',
        side: 'bottom',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 10,
        scrollOffset: 120,
      },
      {
        id: 'step-4',
        tour: 'access',
        icon: <>🚀</>,
        title: 'Хүсэлтийн жагсаалт',
        content: (
          <p>Хүсэлтийн жагсаалт хэн, хаашаа, хаанаас, хаашаа, хэзээ, яаж хандсан талаархи дэлгэрэнгүй мэдээллийг агуулна. Мөн мөр тус бүр дээр дарж дэлгэрэнгүйг харах боломжтой.</p>
        ),
        selector: '#access-tour4',
        side: 'top',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 10,
        scrollOffset: 120,
      },
      {
        id: 'step-5',
        tour: 'access',
        icon: <>🚀</>,
        title: 'Шүүлтүүр',
        content: (
          <p>Эдгээр сонголтуудаар шүүх боломжтой.</p>
        ),
        selector: '#access-tour5',
        side: 'bottom',
        showControls: true,
        showSkip: true,
        pointerPadding: 10,
        pointerRadius: 10,
        scrollOffset: 120,
      },
    ]
}