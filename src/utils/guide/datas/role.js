
export const RoleGuide = {
  tour: 'role',
  steps: [
    {
      id: 'step-1',
      tour: 'role',
      icon: <>👋</>,
      title: 'Хандах эрх',
      content: (
        <p>
          Энэ хуудсанд та хандах эрхүүдийг удирдах боломжтой.
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
    //   tour: 'role',
    //   icon: <>📝</>,
    //   title: 'Хандах эрх үүсгэх',
    //   content: (
    //     <p>
    //       Энд дарснаар шинэ хандах эрх үүсгэх боломжтой.
    //     </p>
    //   ),
    //   selector: '#role-create',
    //   side: 'left',
    //   showControls: true,
    //   showSkip: true,
    //   pointerPadding: 10,
    //   pointerRadius: 10,
    //   perm: 'create',
    // },
    {
      id: 'step-2',
      tour: 'role',
      icon: <>📝</>,
      title: 'Хандах эрхийн жагсаалт',
      content: (
        <p>
          Системд бүртгэлтэй хандах эрхүүдийн жагсаалт.
        </p>
      ),
      selector: '#role-table',
      side: 'bottom',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
    },
    {
      id: 'step-5',
      tour: 'role',
      icon: <>✏️</>,
      title: 'Хандах эрх засах',
      content: (
        <p>
          Энд дарснаар тухайн эрхийн юу хийж болохыг удирдах мөн устгах боломжтой.
        </p>
      ),
      selector: '#role-edit-1',
      side: 'left',
      showControls: true,
      showSkip: true,
      pointerPadding: 10,
      pointerRadius: 10,
      perm: 'update',
    },
  ],
}
