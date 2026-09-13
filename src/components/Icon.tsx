import React from 'react';
import { FontAwesome5 } from '@expo/vector-icons';

/**
 * Icon dùng chung cho toàn bộ app — thay thế mọi emoji trước đây bằng icon
 * Font Awesome (qua @expo/vector-icons, không cần link native).
 *
 * name: tên icon Font Awesome 5 (vd. "cog", "search", "trash", ...)
 * solid: true = kiểu "solid" (mặc định), false = kiểu "regular" (viền, vd. star rỗng)
 */
export interface IconProps {
  name: React.ComponentProps<typeof FontAwesome5>['name'];
  size?: number;
  color?: string;
  solid?: boolean;
  style?: React.ComponentProps<typeof FontAwesome5>['style'];
}

export default function Icon({ name, size = 16, color = '#fff', solid = true, style }: IconProps) {
  return <FontAwesome5 name={name} size={size} color={color} solid={solid} style={style} />;
}
