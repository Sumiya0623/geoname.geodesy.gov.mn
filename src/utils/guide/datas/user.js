
export const UserGuide = {
  tour: 'user',
  steps: [
    {
      id: 'step-1',
      tour: 'user',
      icon: <>👋</>,
      title: 'Хэрэглэгч',
      content: (
        <p>
          Энэ хуудсанд та хэрэглэгчдийн мэдээллийг удирдах боломжтой.
        </p>
      ),
      side: 'top',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    // Үүсгэх хэсэг яах билээ дээ.
    // {
    //   id: 'step-4',
    //   tour: 'user',
    //   icon: <>📝</>,
    //   title: 'Хэрэглэгч үүсгэх',
    //   content: (
    //     <p>
    //       Энд дарснаар шинэ Хэрэглэгч үүсгэх боломжтой.
    //     </p>
    //   ),
    //   selector: '#user-create',
    //   side: 'left',
    //   showControls: true,
    //   showSkip: true,
    //   pointerPadding: 10,
    //   pointerRadius: 10,
    //   perm: 'create',
    // },
    {
      id: 'step-2',
      tour: 'user',
      icon: <>📝</>,
      title: 'Хэрэглэгчийн жагсаалт',
      content: (
        <p>
          Системд бүртгэлтэй хэрэглэгчдийн жагсаалт.
        </p>
      ),
      selector: '#user-table',
      side: 'bottom',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-5',
      tour: 'user',
      icon: <>✏️</>,
      title: 'Хэрэглэгч засах',
      content: (
        <p>
          Энд дарснаар тухайн хэрэглэгчийн хамаарах байгууллага болон хандах эрхийг удирдах боломжтой.
        </p>
      ),
      selector: '#user-edit-1',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
      perm: 'update',
    },
  ],
}
